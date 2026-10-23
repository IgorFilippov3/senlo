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

  const limited = await host.rateLimit.limitRequest(req, "upload", `user:${userId}`);
  if (limited) return limited;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const upload = host.getServices().upload;
    // Size first, before the whole file is read into memory.
    upload.assertSize(file.size);
    const { url } = await upload.storeImage(new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ url });
  } catch (error) {
    logError(host.logger, "Upload failed", error, { userId });
    return errorResponse(error);
  }
}
