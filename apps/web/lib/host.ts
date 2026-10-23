// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createSenloHost } from "@senlo/next";
import { logger } from "./logger";
import { rateLimit } from "./rate-limit";
import { getServices } from "./services";
import { currentUserId, requireUserId } from "./session";

/** What `@senlo/next` gets from this app: services, the session, logger and rate limits. */
export const host = createSenloHost({
  getServices,
  requireUserId,
  currentUserId,
  logger,
  rateLimit,
});
