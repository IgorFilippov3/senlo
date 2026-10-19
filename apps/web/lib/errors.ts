/**
 * Structured error system for Server Actions and API routes.
 * Provides consistent error handling across the application.
 */

import { NextResponse } from "next/server";
import { AppError, FormValidationError, ValidationError, type ErrorCode } from "@senlo/core";

// The error classes live in core so services can throw them and every app
// maps them the same way. Re-exported here for existing imports.
export {
  AppError,
  FormValidationError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  RateLimitedError,
  DatabaseError,
  type ErrorCode,
} from "@senlo/core";

/**
 * Serializable error type for client components
 */
export type SerializableError = {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  statusCode: number;
};

/**
 * Result type for Server Actions that can fail
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: SerializableError };

/**
 * Wraps Server Action execution with error handling
 */
export async function withErrorHandling<T>(
  action: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await action();
    return { success: true, data };
  } catch (error) {
    console.error("SERVER ACTION ERROR:", error);

    if (error instanceof AppError) {
      return { success: false, error: error.toJSON() };
    }

    // Convert unknown errors to AppError. The message stays: actions throw
    // plain Errors with text meant for the user. The stack does not - it is
    // in the server log above, and in a response it hands out file paths and
    // driver internals. Kept in development, where it saves a trip to the log.
    const appError = new AppError(
      'UNKNOWN_ERROR',
      error instanceof Error ? error.message : 'An unknown error occurred',
      process.env.NODE_ENV === 'development'
        ? { originalError: error instanceof Error ? error.stack : String(error) }
        : undefined
    );

    return { success: false, error: appError.toJSON() };
  }
}

/**
 * Result type for Server Actions behind a form: errors come back per field,
 * in zod's flattened shape, so the form can show them next to the inputs.
 */
export type FormActionResult<T, F extends string = string> =
  | { success: true; data: T }
  | { error: { formErrors: string[]; fieldErrors: Partial<Record<F, string[]>> } };

/**
 * Wraps a form Server Action. A `FormValidationError` from a service keeps
 * its fields; any other failure lands under `general`.
 */
export async function withFormErrors<T, F extends string = string>(
  action: () => Promise<T>,
): Promise<FormActionResult<T, F>> {
  try {
    return { success: true, data: await action() };
  } catch (error) {
    if (error instanceof FormValidationError) {
      return {
        error: {
          formErrors: error.formErrors,
          fieldErrors: error.fieldErrors as Partial<Record<F, string[]>>,
        },
      };
    }
    console.error("SERVER ACTION ERROR:", error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    return { error: { formErrors: [], fieldErrors: { general: [message] } as Partial<Record<F, string[]>> } };
  }
}

/**
 * Maps a failure inside an API route to a JSON response: an `AppError`
 * answers with its own status and message (a form error with its first
 * field message), anything else is a 500 with `fallback`, logged by the
 * caller.
 */
export function errorResponse(error: unknown, fallback = "Internal server error"): NextResponse {
  if (error instanceof FormValidationError) {
    const first = Object.values(error.fieldErrors).flat().find(Boolean) ?? error.formErrors[0];
    return NextResponse.json(
      { error: first ?? error.message, details: error.details },
      { status: error.statusCode },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.statusCode },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/**
 * Validates that a number is valid and positive
 */
export function validateId(id: unknown, fieldName: string = 'id'): number {
  const numId = Number(id);
  if (!id || isNaN(numId) || numId <= 0) {
    throw new ValidationError(
      `Invalid ${fieldName}: must be a positive number`,
      { provided: id, field: fieldName }
    );
  }
  return numId;
}
