import { UnauthorizedError } from "@senlo/core";
import { auth } from "@/auth";

/**
 * The signed-in user's id, or `UnauthorizedError`. Call it inside
 * `withErrorHandling` so the error reaches the client as an action result.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}
