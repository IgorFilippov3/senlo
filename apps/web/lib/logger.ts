// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createLogger, type Logger } from "@senlo/core";

/** The app's logger: readable lines in development, one JSON object per line otherwise. */
export const logger: Logger = createLogger();
