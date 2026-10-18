import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";
import { auth } from "../../../auth";
import { limitRequest } from "apps/web/lib/rate-limit";

function detectImageExtension(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await limitRequest(req, "upload", `user:${session.user.id}`);
    if (limited) return limited;

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Size first, before the whole file is read into memory.
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max size is 5MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // The type is read from the file's own bytes, not from the browser's
    // claim, and the extension follows from it. SVG is not accepted: it can
    // carry script, and uploads are served from the app's own origin.
    const extension = detectImageExtension(buffer);
    if (!extension) {
      return NextResponse.json(
        { error: "Invalid file type. Upload a JPEG, PNG, GIF or WebP image." },
        { status: 400 },
      );
    }

    const fileName = `${nanoid()}.${extension}`;

    const uploadDir = join(process.cwd(), "public/uploads");
    
    // Ensure directory exists
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Ignore if exists
    }

    const path = join(uploadDir, fileName);
    await writeFile(path, buffer);

    const url = `/uploads/${fileName}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

