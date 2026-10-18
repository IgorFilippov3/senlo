"use server";

import { processUnsubscribe } from "apps/web/lib/unsubscribe";
import { withErrorHandling, ActionResult, AppError } from "apps/web/lib/errors";

export async function unsubscribeAction(
  token: string,
  confirmEmail?: string,
): Promise<
  ActionResult<{ alreadyUnsubscribed?: boolean; needsEmail?: boolean }>
> {
  return withErrorHandling(async () => {
    const result = await processUnsubscribe(token, { confirmEmail });

    if (!result.ok) {
      if (result.reason === "confirm_email") return { needsEmail: true };
      throw result.reason === "invalid"
        ? new AppError("VALIDATION_ERROR", "This unsubscribe link is not valid.")
        : new AppError(
            "NOT_FOUND",
            confirmEmail
              ? "That address does not match this link."
              : "Recipient not found",
          );
    }

    return result.alreadyUnsubscribed ? { alreadyUnsubscribed: true } : {};
  });
}
