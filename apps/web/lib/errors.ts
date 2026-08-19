/**
 * Structured error system for Server Actions and API routes.
 * Provides consistent error handling across the application.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'DUPLICATE_ENTRY'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Base application error with structured information
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly statusCode: number;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode ?? this.getDefaultStatusCode(code);

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  private getDefaultStatusCode(code: ErrorCode): number {
    switch (code) {
      case 'VALIDATION_ERROR':
        return 400;
      case 'UNAUTHORIZED':
        return 401;
      case 'FORBIDDEN':
        return 403;
      case 'NOT_FOUND':
        return 404;
      case 'DUPLICATE_ENTRY':
        return 409;
      case 'EXTERNAL_SERVICE_ERROR':
        return 502;
      case 'DATABASE_ERROR':
        return 500;
      case 'UNKNOWN_ERROR':
      default:
        return 500;
    }
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Validation-specific error for form and input validation
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, details, 400);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with ID ${identifier} not found`
      : `${resource} not found`;

    super('NOT_FOUND', message, { resource, identifier }, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Database operation error
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('DATABASE_ERROR', message, details, 500);
    this.name = 'DatabaseError';
  }
}

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







