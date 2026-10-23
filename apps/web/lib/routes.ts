// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createSenloRoutes } from "@senlo/next";
import { host } from "./host";

/** Every API route handler of the app; each route file under `app/api` re-exports one. */
export const routes = createSenloRoutes(host);
