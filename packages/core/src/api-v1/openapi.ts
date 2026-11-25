// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { ApiErrorSchema, ApiMeSchema, dataEnvelope } from "./schemas";

// Adds `.openapi()` to zod's prototype; the registry needs it on every schema it names.
extendZodWithOpenApi(z);

/** Every API v1 operation as `METHOD /path`; a test checks each one is in the spec and has a route. */
export const API_V1_OPERATIONS = ["GET /api/v1/me", "GET /api/v1/openapi.json"] as const;

function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "An API key with the manage permission: `Authorization: Bearer snl_...`.",
  });
  // Only the schema `register` returns becomes a $ref; the original would be inlined.
  const apiError = registry.register("ApiError", ApiErrorSchema);
  const me = registry.register("Me", ApiMeSchema);

  const errorResponse = (description: string) => ({
    description,
    content: { "application/json": { schema: apiError } },
  });
  /** Answers every authenticated operation can give, whatever it does. */
  const commonErrors = {
    401: errorResponse("Missing, malformed or unknown API key."),
    403: errorResponse("The key lacks the permission this operation needs (PERMISSION_REQUIRED)."),
    429: errorResponse("Too many requests; retry after the Retry-After header."),
    500: errorResponse("Something failed on Senlo's side; retry with backoff."),
  };

  registry.registerPath({
    method: "get",
    path: "/api/v1/me",
    operationId: "getMe",
    summary: "Who is calling",
    description: "The project, permissions and instance behind the API key. Use it to check a connection.",
    security: [{ [bearerAuth.name]: [] }],
    responses: {
      200: { description: "The caller.", content: { "application/json": { schema: dataEnvelope(me) } } },
      ...commonErrors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/openapi.json",
    operationId: "getOpenApiSpec",
    summary: "This specification",
    description: "Public: no API key needed.",
    responses: {
      200: { description: "OpenAPI 3.0 document.", content: { "application/json": { schema: z.object({}).passthrough() } } },
    },
  });

  return registry;
}

let cached: ReturnType<OpenApiGeneratorV3["generateDocument"]> | undefined;

/** The API v1 OpenAPI document, generated once from the zod schemas. */
export function apiV1OpenApiDocument() {
  cached ??= new OpenApiGeneratorV3(buildRegistry().definitions).generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Senlo API v1",
      version: "1.0.0",
      description: [
        "Manage templates, triggers and automations of one project.",
        "",
        "Every response is JSON. Success: `{ \"data\": ... }`. Failure: `{ \"error\": { code, message, hint, issues?, requestId } }`.",
        "Every response carries `X-Request-Id`.",
      ].join("\n"),
    },
    servers: [{ url: "/" }],
  });
  return cached;
}
