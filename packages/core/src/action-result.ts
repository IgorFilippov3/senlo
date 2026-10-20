// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ErrorCode } from "./errors";

/**
 * What a client call returns instead of throwing, so the failure crosses the
 * wire intact. The app's Server Actions produce these; the client data layer
 * in `@senlo/features` consumes them, whatever transport sits in between.
 */

/** An `AppError` as plain data (`AppError.toJSON()`). */
export type SerializableError = {
  code: ErrorCode;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: Record<string, any>;
  statusCode: number;
};

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: SerializableError };

/**
 * A call behind a form: errors come back per field, in zod's flattened shape,
 * so the form can show them next to the inputs. Anything else is under `general`.
 */
export type FormActionResult<T, F extends string = string> =
  | { success: true; data: T }
  | { error: { formErrors: string[]; fieldErrors: Partial<Record<F, string[]>> } };
