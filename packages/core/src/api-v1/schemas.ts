// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { API_PERMISSIONS } from "../api-principal";

/**
 * Request and response shapes of API v1. The routes answer with these and
 * the OpenAPI spec (`./openapi.ts`) is generated from them, so the two cannot
 * drift. Contract: `senlo-managed/docs/api-v1-contract.md`.
 */

/** `error.code` values of API v1. More are added with the routes that need them. */
export const API_V1_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNKNOWN_FIELD",
  "UNAUTHORIZED",
  "QUOTA_EXCEEDED",
  "PERMISSION_REQUIRED",
  "RECIPIENT_NOT_ALLOWED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "IDEMPOTENCY_KEY_REUSED",
  "IDEMPOTENCY_IN_PROGRESS",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "INTERNAL_ERROR",
] as const;
export type ApiV1ErrorCode = (typeof API_V1_ERROR_CODES)[number];

export const ApiIssueSchema = z.object({
  path: z.string().describe("Path to the field, e.g. design.rows[2].columns[0].blocks[1].props.href; empty for the whole body."),
  code: z.string().describe("zod issue code: invalid_type, too_small, unrecognized_keys, ..."),
  message: z.string(),
});

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_V1_ERROR_CODES),
    message: z.string(),
    hint: z.string().optional().describe("What to do next. Written for coding agents."),
    issues: z.array(ApiIssueSchema).optional().describe("Invalid fields, at most 20."),
    issueCount: z.number().int().optional().describe("All invalid fields, when there are more than in issues."),
    details: z.record(z.unknown()).optional(),
    requestId: z.string().describe("Also in the X-Request-Id header. Quote it when asking for support."),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;

/** Every successful v1 response: `{ "data": ... }`. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

export const ApiMeSchema = z.object({
  project: z.object({ id: z.number().int(), name: z.string() }),
  permissions: z.array(z.enum(API_PERMISSIONS)),
  auth: z.object({
    source: z.enum(["api_key", "oauth"]),
    apiKey: z
      .object({ id: z.number().int(), name: z.string(), prefix: z.string() })
      .nullable()
      .describe("The key behind the request; null for an OAuth token."),
    client: z.string().nullable().describe("The Senlo-Client header the request was sent with."),
  }),
  instance: z.object({
    edition: z.enum(["cloud", "self-hosted"]),
    apiVersion: z.literal("v1"),
  }),
});
export type ApiMe = z.infer<typeof ApiMeSchema>;
