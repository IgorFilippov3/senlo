import type { ActionResult, FormActionResult } from "@senlo/core";

/** The data of a successful call; a failure throws with its message. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

/**
 * The data of a successful form call. A failure throws with the first
 * message, taking fields in the order the form shows them.
 */
export function unwrapForm<T>(result: FormActionResult<T>, fields: readonly string[]): T {
  if ("success" in result) return result.data;
  const { fieldErrors, formErrors } = result.error;
  const errors = fieldErrors as Record<string, string[] | undefined>;
  for (const field of [...fields, "general"]) {
    const message = errors[field]?.[0];
    if (message) throw new Error(message);
  }
  const other = Object.values(errors).find((list) => list?.[0])?.[0];
  throw new Error(other ?? formErrors[0] ?? "Validation failed");
}
