// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { UnauthorizedError } from "@senlo/core";
import { auth } from "@/auth";

/** The signed-in user's id, or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * The signed-in user's id, or `UnauthorizedError`. Call it inside
 * `withErrorHandling` so the error reaches the client as an action result.
 */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}
