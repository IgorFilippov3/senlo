"use server";

import { decodeUnsubscribeToken } from "@senlo/core/src/unsubscribe-token";
import { ContactRepository, CampaignRepository, db } from "@senlo/db";
import { logger } from "apps/web/lib/logger";
import { withErrorHandling, ActionResult, AppError } from "apps/web/lib/errors";

export async function unsubscribeAction(token: string): Promise<ActionResult<{ alreadyUnsubscribed?: boolean }>> {
  return withErrorHandling(async () => {
    const data = decodeUnsubscribeToken(token);
    if (!data) {
      throw new AppError("VALIDATION_ERROR", "Invalid token");
    }

    const contactRepo = new ContactRepository(db);
    const campaignRepo = new CampaignRepository(db);

    const contact = await contactRepo.findById(data.contactId);
    if (!contact) {
      throw new AppError("NOT_FOUND", "Contact not found");
    }

    if (contact.unsubscribed) {
      return { alreadyUnsubscribed: true };
    }

    await contactRepo.unsubscribe(data.contactId);

    await campaignRepo.logEvent({
      campaignId: data.campaignId,
      contactId: data.contactId,
      email: contact.email,
      type: "UNSUBSCRIBE",
    });

    return {};
  });
}
