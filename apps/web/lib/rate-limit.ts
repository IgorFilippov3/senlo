// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { redisRateLimitStore } from "@senlo/core/queue";
import { createRateLimit } from "@senlo/next";
import { getConfig } from "./config";
import { getRedis } from "./infra";
import { logger } from "./logger";

/** The app's rate limits (`RATE_LIMITS` from `@senlo/next`), counted in the shared Redis. */
export const rateLimit = createRateLimit({
  store: redisRateLimitStore(getRedis),
  prefix: () => `${getConfig().queuePrefix}:rl`,
  logger,
});
