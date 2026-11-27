// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse } from "next/server";
import { AppError, FormValidationError, MAX_API_ISSUES, type ApiIssue, type ErrorCode } from "@senlo/core";
import type { ApiErrorBody, ApiV1ErrorCode } from "@senlo/core/server";

/**
 * Responses of API v1: `{ data }` on success, `{ error: { code, message,
 * hint, issues?, requestId } }` on failure, `X-Request-Id` on both. The
 * messages and hints are written for coding agents: each says what to do next.
 */

export const REQUEST_ID_HEADER = "X-Request-Id";

/** `req_` and 32 hex characters; logged with every v1 request and returned to the caller. */
export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function v1Json(data: unknown, requestId: string, status = 200): NextResponse {
  return NextResponse.json({ data }, { status, headers: { [REQUEST_ID_HEADER]: requestId } });
}

const CODE_MAP: Record<ErrorCode, ApiV1ErrorCode> = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  PERMISSION_REQUIRED: "PERMISSION_REQUIRED",
  RECIPIENT_NOT_ALLOWED: "RECIPIENT_NOT_ALLOWED",
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",
  IDEMPOTENCY_IN_PROGRESS: "IDEMPOTENCY_IN_PROGRESS",
  DUPLICATE_ENTRY: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  EXTERNAL_SERVICE_ERROR: "PROVIDER_ERROR",
  DATABASE_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ERROR: "INTERNAL_ERROR",
};

/** The hint for an error that brings none of its own. */
export const DEFAULT_HINTS: Record<ApiV1ErrorCode, string> = {
  VALIDATION_ERROR: "Fix the request as the message says and send it again.",
  UNKNOWN_FIELD:
    "Remove the fields listed in issues. GET /api/v1/openapi.json lists the fields each operation accepts.",
  UNAUTHORIZED:
    "Send an API key of this project as `Authorization: Bearer snl_...`. Keys are created in Settings → Keys.",
  QUOTA_EXCEEDED:
    "The plan's monthly limit is reached; retrying now fails too. Wait for the reset date in the message or upgrade the plan.",
  PERMISSION_REQUIRED: "Use an API key that has the permission named in details.permission.",
  FORBIDDEN: "This key may read the record but not change it.",
  RECIPIENT_NOT_ALLOWED: "Send the test to one of the addresses in details.allowed.",
  IDEMPOTENCY_KEY_REUSED: "Use a new Idempotency-Key for a new request.",
  IDEMPOTENCY_IN_PROGRESS: "Wait a second and retry with the same Idempotency-Key.",
  NOT_FOUND:
    "Check the id. List the project's records to find the right one; records of other projects are not visible to this key.",
  CONFLICT: "The record already exists. Read it instead of creating it again.",
  RATE_LIMITED: "Wait the number of seconds in the Retry-After header, then retry.",
  PROVIDER_ERROR:
    "The email provider refused the request; its reason is in the message. Fix the provider setup or the email, then retry.",
  INTERNAL_ERROR: "Retry with backoff. If it keeps failing, report the requestId.",
};

/** Detail keys never shown to an API caller: internals, or already in `issues`. */
const HIDDEN_DETAILS = new Set(["originalError", "issues", "issueCount", "fieldErrors", "formErrors"]);

/** A form error's fields as issues, for services that still validate with `parseInput`. */
function formIssues(error: FormValidationError): ApiIssue[] {
  const issues: ApiIssue[] = [];
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    for (const message of messages ?? []) {
      issues.push({ path: field === "general" ? "" : field, code: "custom", message });
    }
  }
  for (const message of error.formErrors) issues.push({ path: "", code: "custom", message });
  return issues;
}

function visibleDetails(details: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const shown = Object.fromEntries(Object.entries(details).filter(([key]) => !HIDDEN_DETAILS.has(key)));
  return Object.keys(shown).length > 0 ? shown : undefined;
}

/** The status and body for any failure inside a v1 route. Internals never reach the body. */
export function v1ErrorBody(error: unknown, requestId: string): { status: number; body: ApiErrorBody } {
  if (!(error instanceof AppError) || CODE_MAP[error.code] === "INTERNAL_ERROR") {
    return {
      status: 500,
      body: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something failed on Senlo's side.",
          hint: DEFAULT_HINTS.INTERNAL_ERROR,
          requestId,
        },
      },
    };
  }

  const issues: ApiIssue[] | undefined =
    error instanceof FormValidationError
      ? formIssues(error)
      : Array.isArray(error.details?.issues)
        ? (error.details.issues as ApiIssue[])
        : undefined;
  const issueCount = typeof error.details?.issueCount === "number" ? error.details.issueCount : issues?.length;

  const shown = issues?.slice(0, MAX_API_ISSUES) ?? [];

  let code = CODE_MAP[error.code];
  if (code === "VALIDATION_ERROR" && issues?.length && issues.every((i) => i.code === "unrecognized_keys")) {
    code = "UNKNOWN_FIELD";
  }

  // A form error's own message is a generic "Validation failed": the first field says more.
  const firstIssue = issues?.[0];
  const message =
    error instanceof FormValidationError && firstIssue
      ? firstIssue.path
        ? `${firstIssue.path}: ${firstIssue.message}`
        : firstIssue.message
      : error.message;

  return {
    status: error.statusCode,
    body: {
      error: {
        code,
        message,
        hint: error.hint ?? DEFAULT_HINTS[code],
        ...(shown.length ? { issues: shown } : {}),
        ...(issueCount && issueCount > shown.length ? { issueCount } : {}),
        ...(visibleDetails(error.details) ? { details: visibleDetails(error.details) } : {}),
        requestId,
      },
    },
  };
}

export function v1ErrorResponse(error: unknown, requestId: string): NextResponse {
  const { status, body } = v1ErrorBody(error, requestId);
  const headers: Record<string, string> = { [REQUEST_ID_HEADER]: requestId };
  const retryAfter = error instanceof AppError ? error.details?.retryAfter : undefined;
  if (typeof retryAfter === "number" && (body.error.code === "RATE_LIMITED" || body.error.code === "IDEMPOTENCY_IN_PROGRESS")) {
    headers["Retry-After"] = String(retryAfter);
  }
  return NextResponse.json(body, { status, headers });
}
