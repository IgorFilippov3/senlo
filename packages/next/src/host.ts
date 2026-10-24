// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Logger, SenloConfig } from "@senlo/core";
import type { Services } from "@senlo/core/server";
import type { SenloRateLimit } from "./rate-limit";

/**
 * What every server piece of this package needs from the host app. Built
 * once in the host's composition root and passed in; nothing here reads the
 * host's modules or its environment.
 */
export interface SenloHost {
  /** The host's services, built on first use (they need Redis). */
  getServices(): Services;
  /** The signed-in user's id; throws `UnauthorizedError` without a session. */
  requireUserId(): Promise<string>;
  /** The signed-in user's id, or null. */
  currentUserId(): Promise<string | null>;
  /**
   * The parts of the host's config that pages show: the app URL (the send
   * endpoint on the trigger page) and the default sender. A function, like
   * `getServices`, so building the host reads no environment.
   */
  getConfig(): Pick<SenloConfig, "appUrl" | "defaultFromEmail">;
  logger: Logger;
  rateLimit: SenloRateLimit;
  /**
   * Called after an action that changed data succeeded, with its name
   * (`"templates.create"`). A Next.js host revalidates its pages here.
   */
  onMutated?(action: string): void | Promise<void>;
}

/** Typed identity: checks the host object where it is built. */
export function createSenloHost(host: SenloHost): SenloHost {
  return host;
}
