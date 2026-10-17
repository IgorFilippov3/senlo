/**
 * Structured error system for Server Actions and API routes.
 * Provides consistent error handling across the application.
 */

import { AppError, ValidationError, type ErrorCode } from "@senlo/core";

// The error classes live in core so services can throw them and every app
// maps them the same way. Re-exported here for existing imports.
export {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
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

    // Convert unknown errors to AppError
    const appError = new AppError(
      'UNKNOWN_ERROR',
      error instanceof Error ? error.message : 'An unknown error occurred',
      { originalError: error instanceof Error ? error.stack : String(error) }
    );

    return { success: false, error: appError.toJSON() };
  }
}

/**
 * Validates required fields and throws ValidationError if any are missing
 */
export function validateRequiredFields(
  fields: Record<string, any>,
  fieldNames: string[]
): void {
  const missingFields = fieldNames.filter(name => !fields[name]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      { missingFields, providedFields: Object.keys(fields) }
    );
  }
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

/**
 * Validates string field constraints
 */
export function validateStringField(
  value: string,
  fieldName: string,
  options: { min?: number; max?: number; required?: boolean } = {}
): string {
  const trimmed = value?.trim() || '';

  if (options.required && !trimmed) {
    throw new ValidationError(`Field '${fieldName}' is required`);
  }

  if (options.min && trimmed.length < options.min) {
    throw new ValidationError(
      `Field '${fieldName}' must be at least ${options.min} characters long`
    );
  }

  if (options.max && trimmed.length > options.max) {
    throw new ValidationError(
      `Field '${fieldName}' must be at most ${options.max} characters long`
    );
  }

  return trimmed;
}







