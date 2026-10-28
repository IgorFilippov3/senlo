// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StoragePort } from "./storagePort";
import { IMAGE_TYPES, isUploadKey } from "./uploadService";

/** A stored upload the app can stream back: where it is, how big, what type. */
export interface LocalUploadFile {
  path: string;
  size: number;
  contentType: string;
}

/**
 * Files under one directory of the app's own disk, such as Next's
 * `public/uploads`. The URL is the public prefix plus the key.
 *
 * The app serves these itself (see `stat`) rather than relying on Next's
 * static file handling: `next start` indexes `public/` once at startup, so a
 * file written later would 404 until the next restart.
 */
export class LocalDiskStorage implements StoragePort {
  constructor(
    private readonly rootDir: string,
    private readonly publicPrefix: string,
  ) {}

  async put(key: string, bytes: Uint8Array): Promise<{ url: string }> {
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(join(this.rootDir, key), bytes);
    return { url: `${this.publicPrefix.replace(/\/$/, "")}/${key}` };
  }

  /**
   * The file behind a key, or null when the key is not one `UploadService`
   * would have produced (so no path can escape `rootDir`) or the file is gone.
   */
  async stat(key: string): Promise<LocalUploadFile | null> {
    if (!isUploadKey(key)) return null;
    const path = join(this.rootDir, key);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) return null;
    const extension = key.slice(key.lastIndexOf(".") + 1).toLowerCase() as keyof typeof IMAGE_TYPES;
    return { path, size: info.size, contentType: IMAGE_TYPES[extension] };
  }
}
