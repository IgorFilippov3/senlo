// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextRequest, NextResponse } from "next/server";
import { logError } from "@senlo/core";
import { errorResponse } from "@senlo/next";
import { host } from "@/lib/host";

export async function POST(req: NextRequest) {
  const userId = await host.currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await host.rateLimit.limitRequest(req, "ai", `user:${userId}`);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const design = await host.getServices().aiDesign.generate(userId, body);
    return NextResponse.json({ design });
  } catch (error) {
    logError(host.logger, "AI generation failed", error, { userId });
    return errorResponse(error, "Failed to generate template");
  }
}
