// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextRequest, NextResponse } from "next/server";
import { logError } from "@senlo/core";
import { errorResponse, validateApiKey } from "@senlo/next";
import { host } from "@/lib/host";

export async function POST(req: NextRequest) {
  const limited = await host.rateLimit.limitRequest(req, "api");
  if (limited) return limited;

  const auth = await validateApiKey(host, req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const result = await host.getServices().trigger.sendFromRequest(auth.apiKey.projectId, body);

    host.logger.info("Triggered email queued via API", {
      projectId: auth.apiKey.projectId,
      jobId: result.jobId,
    });

    return NextResponse.json({ success: true, message: "Email queued successfully" });
  } catch (error) {
    logError(host.logger, "Triggered email API error", error, { projectId: auth.apiKey.projectId });
    return errorResponse(error);
  }
}
