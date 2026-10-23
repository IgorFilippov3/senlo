// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse } from "next/server";
import { bearerToken, type ApiKey } from "@senlo/core";
import type { SenloHost } from "./host";

export type ApiAuthResult =
  | { success: true; apiKey: ApiKey }
  | { success: false; response: NextResponse };

/** The API key named by the request's bearer token, or the 401 to answer with. */
export async function validateApiKey(host: SenloHost, req: Request): Promise<ApiAuthResult> {
  const token = bearerToken(req.headers.get("Authorization"));
  if (!token) {
    return {
      success: false,
      response: NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 }),
    };
  }

  const apiKey = await host.getServices().auth.validateApiKey(token);
  if (!apiKey) {
    return {
      success: false,
      response: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
    };
  }
  return { success: true, apiKey };
}
