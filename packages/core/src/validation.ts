// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { z } from "zod";
import { FormValidationError } from "./errors";

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
