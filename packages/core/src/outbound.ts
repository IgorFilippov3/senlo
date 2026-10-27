// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Where user-configured connections may go. Two places in core connect to
 * an address a user typed: the automation "API condition" node (a POST to
 * any URL) and the SMTP provider (host and port). Self-hosted runs on the
 * user's own network, so the default allows everything, exactly as before;
 * a shared instance passes `publicInternetOnly()` (`@senlo/core/server`),
 * which refuses loopback, private, link-local and metadata addresses, so a
 * tenant cannot probe the host's Redis, database or cloud metadata.
 */
export interface OutboundTarget {
  host: string;
  port?: number;
}

export type OutboundDecision = { allowed: true } | { allowed: false; reason: string };

export interface OutboundPolicy {
  allow(target: OutboundTarget): Promise<OutboundDecision>;
}

export const allowAllOutbound: OutboundPolicy = {
  async allow() {
    return { allowed: true };
  },
};

export class OutboundRefusedError extends Error {
  constructor(target: OutboundTarget, reason: string) {
    super(`Connection to ${target.host}${target.port ? `:${target.port}` : ""} refused: ${reason}`);
    this.name = "OutboundRefusedError";
  }
}

/** Throws `OutboundRefusedError` when the policy says no. */
export async function assertOutbound(policy: OutboundPolicy, target: OutboundTarget): Promise<void> {
  const decision = await policy.allow(target);
  if (!decision.allowed) throw new OutboundRefusedError(target, decision.reason);
}

const MAX_REDIRECTS = 5;

/**
 * `fetch` that asks the policy before every hop: only `http:` and `https:`,
 * and a redirect is followed by hand so its target is checked too (a public
 * URL that answers with `Location: http://169.254.169.254/` is the classic
 * way around a check on the first URL only). The address is checked right
 * before the request; a host whose DNS answer changes between the check and
 * the connection (rebinding) is not caught here.
 */
export async function fetchWithPolicy(
  url: string,
  init: Omit<RequestInit, "redirect">,
  policy: OutboundPolicy,
): Promise<Response> {
  let current = url;
  for (let hop = 0; ; hop++) {
    const parsed = parseHttpUrl(current);
    await assertOutbound(policy, { host: parsed.hostname, port: portOf(parsed) });
    const response = await fetch(current, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (!isRedirect(response.status) || !location) return response;
    if (hop >= MAX_REDIRECTS) throw new Error(`Too many redirects from ${url}`);
    // The body of a redirect is never read; release it.
    await response.body?.cancel().catch(() => {});
    current = new URL(location, current).toString();
  }
}

function parseHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Only http and https URLs are allowed, got ${parsed.protocol}`);
  }
  return parsed;
}

function portOf(url: URL): number {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
