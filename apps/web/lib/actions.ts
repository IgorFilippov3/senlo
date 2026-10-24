// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use server";

import { dispatchPublicAction, dispatchSenloAction } from "@senlo/next";
import { host } from "./host";

/**
 * The app's only Server Actions besides sign-in. Every call of the data
 * layer and the editor comes through `senloAction` by name; the dispatcher
 * checks the name, the session and the arguments' shape. Both functions are
 * reachable by anyone who can post to the app, like every Server Action.
 */
export async function senloAction(name: string, args: unknown[]): Promise<unknown> {
  return dispatchSenloAction(host, name, args);
}

/** Calls that need no session: the unsubscribe page. */
export async function senloPublicAction(name: string, args: unknown[]): Promise<unknown> {
  return dispatchPublicAction(host, name, args);
}
