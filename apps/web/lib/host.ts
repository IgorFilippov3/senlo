// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { revalidatePath } from "next/cache";
import { createSenloHost } from "@senlo/next";
import { getConfig } from "./config";
import { logger } from "./logger";
import { rateLimit } from "./rate-limit";
import { getServices } from "./services";
import { currentUserId, requireUserId } from "./session";

/** What `@senlo/next` gets from this app: services, the session, config, logger and rate limits. */
export const host = createSenloHost({
  getServices,
  requireUserId,
  currentUserId,
  getConfig,
  logger,
  rateLimit,
  // After a change, every page renders fresh data on its next visit (and
  // the current one at once): the server-rendered pages read services
  // directly, the client cache is react-query's and invalidates itself.
  onMutated: () => revalidatePath("/", "layout"),
});
