// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StoragePort } from "./storagePort";

/**
 * Files under one directory the web server already serves, such as Next's
 * `public/uploads`. The URL is the public prefix plus the key.
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
}
