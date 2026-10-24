// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createClientActions } from "@senlo/features";
import { senloAction } from "./actions";

/** The client data layer's transport: every call is the one Server Action `senloAction`. */
export const clientActions = createClientActions(senloAction);
