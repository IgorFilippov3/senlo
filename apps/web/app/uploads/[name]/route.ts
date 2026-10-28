// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { localUploads } from "@/lib/services";

/**
 * `GET /uploads/<name>`: an image uploaded to the app's own disk.
 *
 * Next serves `public/` from an index it builds once at startup, so a file
 * uploaded after that would 404 until the next restart (#1). Files Next does
 * know about never reach this handler; the rest are streamed from here. With
 * `STORAGE_DRIVER=s3` upload URLs point at the bucket and this stays unused.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const file = await localUploads()?.stat((await params).name);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(Readable.toWeb(createReadStream(file.path)) as ReadableStream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
