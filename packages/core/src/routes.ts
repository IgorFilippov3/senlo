// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Which paths need no session. Shared by the app's auth middleware and any
 * other shell over the same routes, so the list exists once.
 */

/** Exact public paths. */
export const PUBLIC_PATHS = ["/", "/api-docs"] as const;

/** Public path prefixes. */
export const PUBLIC_PATH_PREFIXES = [
  "/privacy",
  "/terms",
  // Auth.js owns everything under /api/auth - its OAuth callback and error
  // pages included. Guarding them redirects the provider's callback to
  // /login before the handler ever runs, which silently breaks OAuth sign-in.
  "/api/auth/",
  // Open pixel and click redirect, fetched by mail clients and recipients.
  // /api/track/ serves links in mail sent before signed tracking links.
  "/api/t/",
  "/api/track/",
  // The unsubscribe page and the one-click endpoint are opened by recipients,
  // who are not signed in.
  "/unsubscribe/",
  "/api/unsubscribe/",
  "/api/debug/",
  "/api/webhooks/",
] as const;

/** Sign-in and sign-up pages: public, but a signed-in user is sent home. */
export const AUTH_PATH_PREFIXES = ["/login", "/register"] as const;

/** Routes authenticated by an API key in the Authorization header instead of a session. */
export const API_KEY_PATH_PREFIXES = ["/api/v1/", "/api/events", "/api/triggered"] as const;

/**
 * Whether `pathname` needs no session. `extraPrefixes` are the host's own
 * public paths on top of Senlo's (the managed app: invite acceptance, its
 * billing webhook, marketing pages); they never make a Senlo path private.
 */
export function isPublicPath(pathname: string, extraPrefixes: readonly string[] = []): boolean {
  return (
    (PUBLIC_PATHS as readonly string[]).includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    extraPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isApiKeyPath(pathname: string): boolean {
  return API_KEY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
