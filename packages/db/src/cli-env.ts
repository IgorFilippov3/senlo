// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync } from "node:fs";
import path from "node:path";

function loadEnvFile(file: string) {
  const load = (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (typeof load !== "function") {
    throw new Error(
      `Node.js 20.12 or newer is needed to read ${file} (running ${process.version}). Upgrade Node, or set the variables in the environment instead.`,
    );
  }
  load.call(process, file);
}

/**
 * For command-line scripts run from a checkout: loads the first .env found -
 * in the working directory, then the web app's - without overriding
 * variables that are already set. In a container the environment is set and
 * no file exists, so this does nothing. Not exported from the package: the
 * app and the worker load their environment themselves.
 */
export function loadLocalEnv(cwd: string = process.cwd()) {
  const candidates = [
    path.join(cwd, ".env"),
    path.join(cwd, "apps/web/.env"),
    path.join(cwd, "../../apps/web/.env"),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (file) {
    loadEnvFile(file);
  }
}
