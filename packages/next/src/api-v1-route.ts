// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse, type NextRequest } from "next/server";
import {
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
  bearerToken,
  clientLabel,
  logError,
  requirePermission,
  type ApiPermission,
  type ApiPrincipal,
} from "@senlo/core";
import { REQUEST_ID_HEADER, newRequestId, v1ErrorResponse, v1Json } from "./api-v1";
import type { SenloHost } from "./host";

/** What Next passes as the second argument to a handler of a dynamic route. */
export interface V1RouteContext<P> {
  params: Promise<P>;
}

export interface V1RouteOptions {
  permission: ApiPermission;
  /**
   * Honours `Idempotency-Key`: a retry with the same key and body within a
   * day gets the first answer (with `Idempotent-Replayed: true`) and runs
   * nothing. For routes that create something.
   */
  idempotent?: boolean;
}

export interface V1RunContext<P> {
  principal: ApiPrincipal;
  req: NextRequest;
  requestId: string;
  params: P;
  /** The parsed JSON body; undefined for GET or an empty body. */
  body: unknown;
}

export type V1Run<P> = (ctx: V1RunContext<P>) => Promise<{ data: unknown; status?: number }>;

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/** The JSON body, or `ValidationError` when it is not JSON. */
async function readBody(req: NextRequest): Promise<unknown> {
  if (!METHODS_WITH_BODY.has(req.method)) return undefined;
  const text = await req.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError(
      "The request body is not valid JSON.",
      undefined,
      "Send a JSON object with Content-Type: application/json.",
    );
  }
}

/** The rate-limit caller of a principal: its key, or its user and project. */
function principalCaller(principal: ApiPrincipal): string {
  return "apiKeyId" in principal.actor
    ? `key:${principal.actor.apiKeyId}`
    : `user:${principal.actor.userId}:${principal.projectId}`;
}

/** A 429 from the rate limiter, in the v1 error shape. */
function limitedResponse(limited: Response, requestId: string): NextResponse {
  return v1ErrorResponse(new RateLimitedError(Number(limited.headers.get("Retry-After") ?? 60)), requestId);
}

/**
 * Builds API v1 route handlers for a host. Each request: a request id, the
 * principal from the bearer token, a limit per principal (failed
 * authentication is limited per IP instead), the permission, the JSON body,
 * `Idempotency-Key` when the route takes it, then `run`. Answers `{ data }`
 * or the v1 error shape, always with `X-Request-Id`.
 */
export function createV1Route(host: SenloHost) {
  const services = () => host.getServices();

  return <P = Record<string, never>>(operation: string, options: V1RouteOptions, run: V1Run<P>) =>
    async (req: NextRequest, context?: V1RouteContext<P>): Promise<Response> => {
      const requestId = newRequestId();
      let principal: ApiPrincipal | null = null;
      let idempotencyId: number | null = null;
      try {
        const token = bearerToken(req.headers.get("Authorization"));
        principal = token
          ? await services().auth.resolvePrincipal(token, clientLabel(req.headers.get("Senlo-Client")))
          : null;
        if (!principal) {
          const limited = await host.rateLimit.limitRequest(req, "apiAuthFailure");
          if (limited) return limitedResponse(limited, requestId);
          throw new UnauthorizedError(token ? "Invalid API key." : "Missing or malformed Authorization header.");
        }

        const limited = await host.rateLimit.limitRequest(req, "apiV1", principalCaller(principal));
        if (limited) return limitedResponse(limited, requestId);

        requirePermission(principal, options.permission);

        const params = context ? await context.params : ({} as P);
        const body = await readBody(req);

        const key = options.idempotent ? req.headers.get("Idempotency-Key") : null;
        if (key !== null) {
          const start = await services().idempotency.begin(
            principal.projectId,
            key,
            `${req.method} ${new URL(req.url).pathname}`,
            body,
          );
          if (!start.run) {
            host.logger.info(`API v1 ${operation} replayed`, { requestId, projectId: principal.projectId });
            return NextResponse.json(start.body, {
              status: start.status,
              headers: { [REQUEST_ID_HEADER]: requestId, "Idempotent-Replayed": "true" },
            });
          }
          idempotencyId = start.id;
        }

        const { data, status = 200 } = await run({ principal, req, requestId, params, body });
        if (idempotencyId !== null) {
          await services().idempotency.complete(idempotencyId, status, { data });
        }
        host.logger.info(`API v1 ${operation}`, {
          requestId,
          projectId: principal.projectId,
          client: principal.client,
        });
        return v1Json(data, requestId, status);
      } catch (error) {
        if (idempotencyId !== null) {
          // A failed request frees its key, so the corrected retry runs.
          await services()
            .idempotency.release(idempotencyId)
            .catch((releaseError: unknown) =>
              logError(host.logger, "Idempotency key not released", releaseError, { requestId }),
            );
        }
        logError(host.logger, `API v1 ${operation} failed`, error, {
          requestId,
          projectId: principal?.projectId,
        });
        return v1ErrorResponse(error, requestId);
      }
    };
}
