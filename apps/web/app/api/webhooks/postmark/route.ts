// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextRequest } from "next/server";
import { handleProviderWebhook } from "@senlo/next";
import { host } from "@/lib/host";

export async function POST(req: NextRequest) {
  return handleProviderWebhook(host, req, "POSTMARK");
}
