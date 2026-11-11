// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The HTTP request step (`http_request`): its data shape and checks.
 * Isomorphic: the builder shows the same messages the engine and the
 * service act on.
 */

export const HTTP_STEP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpStepMethod = (typeof HTTP_STEP_METHODS)[number];

/** Seconds the step waits for an answer when the step does not say. */
export const HTTP_STEP_DEFAULT_TIMEOUT_S = 10;
/** The longest timeout a step may set. */
export const HTTP_STEP_MAX_TIMEOUT_S = 30;
/** Bytes of a response body kept in the run's context; a longer one is cut and flagged. */
export const HTTP_RESPONSE_BODY_LIMIT = 64 * 1024;

/**
 * A header of the step. Its value is a secret: the service seals a `value`
 * the builder sends into `sealed` on save, and only `sealed` is stored. The
 * builder sends `sealed` back unchanged to keep a header it did not edit.
 */
export interface HttpStepHeader {
  name: string;
  /** A new value, in clear: only on its way in, never stored. */
  value?: string;
  /** The stored value, sealed with the repositories' `SecretCipher`. */
  sealed?: string;
}

export interface HttpStepData {
  method?: HttpStepMethod;
  url?: string;
  headers?: HttpStepHeader[];
  /** JSON with merge tags (`{{contact.email}}`, `{{event.total}}`), filled at run time. */
  body?: string;
  timeoutSeconds?: number;
  onError?: "fail" | "continue";
}

/** The output an HTTP request (or an API condition) leaves in `context.steps[nodeId]`. */
export interface HttpStepOutput {
  status: number;
  /** Parsed JSON, or the text when it is not JSON. */
  body: unknown;
  /** The body was longer than `HTTP_RESPONSE_BODY_LIMIT` and was cut (kept as text). */
  truncated?: boolean;
}

const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/** What is wrong with an HTTP request step's data, as messages for the user; empty when it can run. */
export function validateHttpStep(data: unknown): string[] {
  const d = (data ?? {}) as HttpStepData;
  const problems: string[] = [];
  if (d.method !== undefined && !(HTTP_STEP_METHODS as readonly string[]).includes(d.method)) {
    problems.push("An HTTP request has an unknown method.");
  }
  if (typeof d.url !== "string" || d.url.trim() === "") {
    problems.push("An HTTP request has no URL.");
  } else if (!/^https?:\/\//i.test(d.url.trim())) {
    problems.push("An HTTP request URL must start with http:// or https://.");
  }
  if (d.headers !== undefined) {
    if (!Array.isArray(d.headers)) {
      problems.push("HTTP request headers are malformed.");
    } else {
      for (const header of d.headers) {
        if (!header || typeof header.name !== "string" || !HEADER_NAME.test(header.name)) {
          problems.push("An HTTP request header has an invalid name.");
          break;
        }
      }
    }
  }
  if (d.timeoutSeconds !== undefined) {
    const t = d.timeoutSeconds;
    if (!Number.isInteger(t) || t < 1 || t > HTTP_STEP_MAX_TIMEOUT_S) {
      problems.push(`An HTTP request timeout must be 1 to ${HTTP_STEP_MAX_TIMEOUT_S} seconds.`);
    }
  }
  if (d.body !== undefined && typeof d.body !== "string") {
    problems.push("An HTTP request body must be text.");
  }
  return problems;
}

/** Whether the step sends a body (GET and DELETE do not). */
export function httpMethodHasBody(method: HttpStepMethod): boolean {
  return method !== "GET" && method !== "DELETE";
}
