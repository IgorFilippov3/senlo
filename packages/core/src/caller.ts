// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ApiPrincipal } from "./api-principal";
import type { AuditActor } from "./hooks";

/**
 * Who is calling a service: a signed-in user's id (the UI, Server Actions)
 * or an API principal (API v1). `AccessGuard` decides for both; a service
 * passes its caller through and never looks inside.
 */
export type Caller = string | ApiPrincipal;

export function isApiCaller(caller: Caller): caller is ApiPrincipal {
  return typeof caller === "object" && caller !== null;
}

/** How a caller is named in the audit log. */
export function auditActor(caller: Caller): AuditActor {
  if (!isApiCaller(caller)) return { userId: caller };
  return "apiKeyId" in caller.actor
    ? { apiKeyId: caller.actor.apiKeyId, client: caller.client }
    : { userId: caller.actor.userId, client: caller.client };
}
