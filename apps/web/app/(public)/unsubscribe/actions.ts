"use server";

import { getServices } from "@/lib/services";
import { withErrorHandling, ActionResult, AppError } from "@/lib/errors";
import { limitAction } from "@/lib/rate-limit";

export async function unsubscribeAction(
  token: string,
  confirmEmail?: string,
): Promise<
  ActionResult<{ alreadyUnsubscribed?: boolean; needsEmail?: boolean }>
> {
  return withErrorHandling(async () => {
    // Tight: a legacy link is confirmed by typing the address, and that
    // must not be guessable by trying addresses in a loop.
    // Per IP and per link, so the limit holds even when the IP is unknown.
    await limitAction("unsubscribe", `token:${token.slice(0, 128)}`);
    const result = await getServices().unsubscribe.process(token, { confirmEmail });

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
