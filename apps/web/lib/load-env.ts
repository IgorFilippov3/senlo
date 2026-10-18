import { existsSync } from "node:fs";

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
 * Loads ./.env for processes Next.js does not start - the worker. Imported
 * first, so the environment is in place before any other module reads it.
 * Variables already set (Docker, the shell) win over the file.
 */
if (existsSync(".env")) {
  loadEnvFile(".env");
}
