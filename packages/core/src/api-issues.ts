// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { z } from "zod";
import { ValidationError } from "./errors";

/**
 * One problem with a request, with the full path to the field. Written for a
 * coding agent: `design.rows[2].columns[0].blocks[1].props.href` lets it fix
 * the one block that is wrong, where a flattened form error would not.
 */
export interface ApiIssue {
  path: string;
  /** zod's issue code (`invalid_type`, `too_small`, `unrecognized_keys`, ...). */
  code: string;
  message: string;
}

/** At most this many issues go into a response; the rest are only counted. */
export const MAX_API_ISSUES = 20;

/** `["design", "rows", 2, "blocks", 0]` as `design.rows[2].blocks[0]`; the root is `""`. */
export function formatIssuePath(path: readonly (string | number)[]): string {
  let out = "";
  for (const part of path) {
    if (typeof part === "number") out += `[${part}]`;
    else out += out ? `.${part}` : part;
  }
  return out;
}

/**
 * zod's issues as `ApiIssue`s, in order. An unknown key becomes one issue per
 * key, at the key's own path, so the agent sees which field to drop.
 */
export function apiIssues(error: z.ZodError): ApiIssue[] {
  const issues: ApiIssue[] = [];
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        issues.push({
          path: formatIssuePath([...issue.path, key]),
          code: "unrecognized_keys",
          message: `Unknown field "${key}". Remove it or check its spelling.`,
        });
      }
      continue;
    }
    issues.push({ path: formatIssuePath(issue.path), code: issue.code, message: issue.message });
  }
  return issues;
}

/**
 * Parses API input with a schema. On failure throws `ValidationError` with
 * `details.issues` (the first `MAX_API_ISSUES`, full paths) and
 * `details.issueCount` (all of them). Unlike `parseInput`, nothing is
 * flattened: nested fields keep their path.
 */
export function parseApiInput<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  const issues = apiIssues(parsed.error);
  const first = issues[0];
  const message =
    issues.length === 1 && first
      ? first.path
        ? `${first.path}: ${first.message}`
        : first.message
      : `The request has ${issues.length} invalid fields.`;
  throw new ValidationError(
    message,
    { issues: issues.slice(0, MAX_API_ISSUES), issueCount: issues.length },
    "Fix the fields listed in issues and send the request again.",
  );
}
