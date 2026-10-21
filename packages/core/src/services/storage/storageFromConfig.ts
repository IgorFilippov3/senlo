// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { StorageConfig } from "../../config";
import { LocalDiskStorage } from "./localDiskStorage";
import { S3Storage } from "./s3Storage";
import type { StoragePort } from "./storagePort";

export interface LocalStorageOptions {
  /** Directory the web server serves, e.g. Next's `public/uploads`. */
  rootDir: string;
  /** URL prefix that directory is served at, e.g. `/uploads`. */
  publicPrefix: string;
}

/** The storage adapter the config asks for; `local` needs to know where the app serves files from. */
export function storageFromConfig(config: StorageConfig, local: LocalStorageOptions): StoragePort {
  if (config.driver === "s3") return new S3Storage(config);
  return new LocalDiskStorage(local.rootDir, local.publicPrefix);
}
