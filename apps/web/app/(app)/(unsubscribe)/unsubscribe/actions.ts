"use server";

import { processUnsubscribe } from "apps/web/lib/unsubscribe";
import { withErrorHandling, ActionResult, AppError } from "apps/web/lib/errors";

export async function unsubscribeAction(
  token: string,
): Promise<ActionResult<{ alreadyUnsubscribed?: boolean }>> {
  return withErrorHandling(async () => {
    const result = await processUnsubscribe(token);

    if (!result.ok) {
      throw result.reason === "invalid"
        ? new AppError("VALIDATION_ERROR", "Invalid token")
        : new AppError("NOT_FOUND", "Recipient not found");
    }

    return result.alreadyUnsubscribed ? { alreadyUnsubscribed: true } : {};
  });
}
