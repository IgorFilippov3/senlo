// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Typed errors shared by the services and every app built on them. An app
 * maps them to its own response shape (server action result, HTTP status) by
 * `code`, so a service never needs to know which transport called it.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PERMISSION_REQUIRED"
  | "RECIPIENT_NOT_ALLOWED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "NOT_PUBLISHABLE"
  | "DUPLICATE_ENTRY"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "EXTERNAL_SERVICE_ERROR"
  | "DATABASE_ERROR"
  | "UNKNOWN_ERROR";

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PERMISSION_REQUIRED: 403,
  RECIPIENT_NOT_ALLOWED: 403,
  IDEMPOTENCY_KEY_REUSED: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  NOT_PUBLISHABLE: 409,
  NOT_FOUND: 404,
  DUPLICATE_ENTRY: 409,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 402,
  EXTERNAL_SERVICE_ERROR: 502,
  DATABASE_ERROR: 500,
  UNKNOWN_ERROR: 500,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly statusCode: number;
  /**
   * What the caller should do next, written for an API client or a coding
   * agent ("Send the request again with ..."). API v1 shows it next to the
   * message; a route that has none gets the default for the code.
   */
  public readonly hint?: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>,
    statusCode?: number,
    hint?: string,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode ?? DEFAULT_STATUS[code];
    this.hint = hint;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
    };
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: Record<string, any>,
    hint?: string,
    /** For a subclass with a code of its own (`NotPublishableError`). */
    code: ErrorCode = "VALIDATION_ERROR",
    statusCode = 400,
  ) {
    super(code, message, details, statusCode, hint);
    this.name = "ValidationError";
  }
}

/**
 * An automation that cannot run as it is: going live, a test run, or a save
 * of a live one. `details.reasons` lists every problem, as the builder's
 * go-live dialog shows them.
 */
export class NotPublishableError extends ValidationError {
  constructor(message: string, reasons: string[]) {
    super(
      message,
      { reasons },
      "Fix every problem in details.reasons, save the draft, then try again.",
      "NOT_PUBLISHABLE",
      409,
    );
    this.name = "NotPublishableError";
  }
}

/**
 * Invalid form input, by field. `fieldErrors` uses zod's flattened shape so a
 * form can show each message next to its field; `general` is for failures
 * that belong to no single field.
 */
export class FormValidationError extends ValidationError {
  constructor(
    public readonly fieldErrors: Record<string, string[] | undefined>,
    public readonly formErrors: string[] = [],
    message = "Validation failed",
  ) {
    super(message, { fieldErrors, formErrors });
    this.name = "FormValidationError";
  }

  /** The error for one field. */
  static field(field: string, message: string): FormValidationError {
    return new FormValidationError({ [field]: [message] });
  }
}

/**
 * The email provider refused a send or did not answer. The message is meant
 * for the user: it carries the provider's own reason.
 */
export class ProviderError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super("EXTERNAL_SERVICE_ERROR", message, details, 502);
    this.name = "ProviderError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with ID ${identifier} not found`
      : `${resource} not found`;
    super("NOT_FOUND", message, { resource, identifier }, 404);
    this.name = "NotFoundError";
  }
}

/**
 * The user may see the record but not change it (a managed viewer role).
 * Only thrown where a read is allowed, so it reveals nothing the user cannot
 * already see; anything they may not read fails with `NotFoundError`.
 */
export class ForbiddenError extends AppError {
  constructor(resource: string, message = `You can view this ${resource.toLowerCase()} but not change it`) {
    super("FORBIDDEN", message, { resource }, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * The API key (or token) is valid but lacks the permission the route needs:
 * `send` for the sending routes, `manage` for API v1.
 */
export class PermissionRequiredError extends AppError {
  constructor(public readonly permission: string) {
    super(
      "PERMISSION_REQUIRED",
      `This API key does not have the "${permission}" permission.`,
      { permission },
      403,
      `Create an API key with the "${permission}" permission in Settings → Keys and use it for this request.`,
    );
    this.name = "PermissionRequiredError";
  }
}

/**
 * A test send through the API to an address outside the organization: API
 * and MCP callers may only mail the organization's own members.
 */
export class RecipientNotAllowedError extends AppError {
  constructor(public readonly allowed: string[]) {
    super(
      "RECIPIENT_NOT_ALLOWED",
      "Test emails through the API go only to members of the workspace's organization.",
      { allowed },
      403,
      allowed.length
        ? `Send the test to one of: ${allowed.join(", ")}.`
        : "No member of this workspace has an address to send tests to.",
    );
    this.name = "RecipientNotAllowedError";
  }
}

/** An `Idempotency-Key` already used for a different request (another body or operation). */
export class IdempotencyKeyReusedError extends AppError {
  constructor() {
    super(
      "IDEMPOTENCY_KEY_REUSED",
      "This Idempotency-Key was already used for a different request.",
      undefined,
      409,
      "Use a new Idempotency-Key for a new request; reuse a key only to retry the exact same request.",
    );
    this.name = "IdempotencyKeyReusedError";
  }
}

/** The first request with this `Idempotency-Key` has not finished yet. */
export class IdempotencyInProgressError extends AppError {
  constructor() {
    super(
      "IDEMPOTENCY_IN_PROGRESS",
      "A request with this Idempotency-Key is still being processed.",
      { retryAfter: 1 },
      409,
      "Wait a second and retry with the same key: you will get the first request's answer.",
    );
    this.name = "IdempotencyInProgressError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message, undefined, 401);
    this.name = "UnauthorizedError";
  }
}

export class RateLimitedError extends AppError {
  constructor(retryAfter: number) {
    super(
      "RATE_LIMITED",
      "Too many attempts. Please wait a moment and try again.",
      { retryAfter },
      429,
    );
    this.name = "RateLimitedError";
  }
}

/** A plan limit (managed `QuotaPolicy`) forbids the action; the reason is shown as is. */
export class QuotaExceededError extends AppError {
  constructor(reason: string) {
    super("QUOTA_EXCEEDED", reason, undefined, 402);
    this.name = "QuotaExceededError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super("DATABASE_ERROR", message, details, 500);
    this.name = "DatabaseError";
  }
}

/**
 * A workflow step failed for a reason that may pass: a network failure or
 * timeout, a 5xx or 429 from the user's URL, the database or queue briefly
 * unreachable. The automation worker lets BullMQ retry the job (with
 * backoff); on the last attempt the step's `onError` applies. Every other
 * error of a step is permanent and applies `onError` at once.
 */
export class RetryableStepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableStepError";
  }
}
