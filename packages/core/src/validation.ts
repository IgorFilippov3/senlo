// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { z } from "zod";
import { FormValidationError, ValidationError } from "./errors";

/**
 * Runs raw input (form fields, a JSON body) through a schema; a failure is a
 * `FormValidationError` the app can hand straight to the form.
 */
export function parseInput<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten();
    throw new FormValidationError(fieldErrors, formErrors);
  }
  return parsed.data;
}

/**
 * A whole number in `[min, max]` from caller input, or `fallback` when it is
 * absent. For values that end up in a query (a time window, a page size):
 * server action arguments come from the client as is, whatever their
 * TypeScript type says, so anything else is refused rather than coerced.
 */
export function boundedInt(
  value: unknown,
  { field, min, max, fallback }: { field: string; min: number; max: number; fallback: number },
): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${field} must be a whole number from ${min} to ${max}`);
  }
  return value;
}
