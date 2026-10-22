// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The public address a project's links point at: tracking, unsubscribe, and
 * relative image URLs in its emails and its editor. Self-hosted has one
 * (`appUrl`); a managed install can answer with a project's own domain.
 * Returned without a trailing slash.
 */
export type ResolveBaseUrl = (projectId: number) => Promise<string>;

/** Every project on the configured `appUrl`: self-hosted. */
export function fixedBaseUrl(appUrl: string): ResolveBaseUrl {
  const url = trimTrailingSlash(appUrl);
  return async () => url;
}

/** The resolver's answer, normalized: a host that returns `https://x.test/` still gets `https://x.test/api/...`. */
export async function resolveProjectBaseUrl(resolve: ResolveBaseUrl, projectId: number): Promise<string> {
  return trimTrailingSlash(await resolve(projectId));
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
