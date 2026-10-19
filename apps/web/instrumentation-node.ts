/**
 * Node-only part of `instrumentation.ts`, kept in its own module so the Edge
 * build never sees `process.exit`. Checks the configuration up front, so a
 * missing secret or address stops the server with a clear list of what to
 * fix instead of failing on the first email or login.
 */
import { getConfig } from "./lib/config";

try {
  getConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
