// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PermissionRequiredError } from "./errors";

/**
 * What an API key or token may do. Independent: a key may hold one or both.
 * - `send`: live sending and events (`/api/triggered`, `/api/events`,
 *   `/api/automations/cancel`).
 * - `manage`: API v1 (templates, triggers, automations) and test sends to the
 *   organization's own addresses. Never live sends.
 */
export const API_PERMISSIONS = ["send", "manage"] as const;
export type ApiPermission = (typeof API_PERMISSIONS)[number];

/** Who is behind a request: an API key, or (later) a user's OAuth token. */
export type ApiActor = { apiKeyId: number } | { userId: string };

/**
 * The caller of an API route, however it authenticated. Routes read the
 * project and the permissions from here and never from the key itself, so an
 * OAuth token can become a principal later without any route changing.
 */
export interface ApiPrincipal {
  projectId: number;
  permissions: readonly ApiPermission[];
  source: "api_key" | "oauth";
  actor: ApiActor;
  /**
   * The client's own label from the `Senlo-Client` header (`mcp/1.0.0`), for
   * versions and the audit log. Anyone can send any value: it never grants
   * or refuses anything.
   */
  client: string | null;
}

/** Longest `Senlo-Client` value kept; longer ones are cut. */
export const MAX_CLIENT_LABEL_LENGTH = 100;

/**
 * The `Senlo-Client` header as a label: trimmed, printable ASCII only, at
 * most `MAX_CLIENT_LABEL_LENGTH` characters. Null when absent or empty.
 */
export function clientLabel(header: string | null | undefined): string | null {
  if (!header) return null;
  const label = header.replace(/[^\x20-\x7e]/g, "").trim().slice(0, MAX_CLIENT_LABEL_LENGTH);
  return label || null;
}

/**
 * The principal of an API key. Keys have no permission field yet (step 2 of
 * the API v1 plan adds it), so every key holds both permissions, as every
 * key could already import and publish workflows.
 */
export function principalFromApiKey(apiKey: { id: number; projectId: number }, client: string | null): ApiPrincipal {
  return {
    projectId: apiKey.projectId,
    permissions: API_PERMISSIONS,
    source: "api_key",
    actor: { apiKeyId: apiKey.id },
    client,
  };
}

export function hasPermission(principal: ApiPrincipal, permission: ApiPermission): boolean {
  return principal.permissions.includes(permission);
}

/** Throws `PermissionRequiredError` (403) when the principal lacks `permission`. */
export function requirePermission(principal: ApiPrincipal, permission: ApiPermission): void {
  if (!hasPermission(principal, permission)) throw new PermissionRequiredError(permission);
}
