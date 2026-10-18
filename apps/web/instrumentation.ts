/**
 * Runs once when the server starts. Checks the configuration up front, so a
 * missing secret or address stops the server with a clear list of what to
 * fix instead of failing on the first email or login.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getConfig } = await import("./lib/config");
  try {
    getConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
