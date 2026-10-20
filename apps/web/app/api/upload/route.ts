import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { errorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { limitRequest } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await limitRequest(req, "upload", `user:${session.user.id}`);
  if (limited) return limited;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const upload = getServices().upload;
    // Size first, before the whole file is read into memory.
    upload.assertSize(file.size);
    const { url } = await upload.storeImage(new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ url });
  } catch (error) {
    logger.error("Upload failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
}
