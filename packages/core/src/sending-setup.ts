// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Whether a workspace can send email, and if not, what the user has to do:
 * - `ready`: an email provider is selected;
 * - `no-providers`: the account has no email provider yet (add one on the
 *   Providers page first);
 * - `not-selected`: providers exist, but this workspace uses none (pick one
 *   in its Settings).
 */
export type SendingSetup = "ready" | "no-providers" | "not-selected";

/**
 * `providerCount` is the number of email providers the user can choose
 * from (the account's or the organization's).
 */
export function sendingSetupOf(workspace: { providerId?: number | null }, providerCount: number): SendingSetup {
  if (workspace.providerId) return "ready";
  return providerCount > 0 ? "not-selected" : "no-providers";
}
