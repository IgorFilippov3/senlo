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
  | "DUPLICATE_ENTRY"
  | "EXTERNAL_SERVICE_ERROR"
  | "DATABASE_ERROR"
  | "UNKNOWN_ERROR";

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DUPLICATE_ENTRY: 409,
  EXTERNAL_SERVICE_ERROR: 502,
  DATABASE_ERROR: 500,
  UNKNOWN_ERROR: 500,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly statusCode: number;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>,
    statusCode?: number,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode ?? DEFAULT_STATUS[code];
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
  constructor(message: string, details?: Record<string, any>) {
    super("VALIDATION_ERROR", message, details, 400);
    this.name = "ValidationError";
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

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message, undefined, 401);
    this.name = "UnauthorizedError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super("DATABASE_ERROR", message, details, 500);
    this.name = "DatabaseError";
  }
}
