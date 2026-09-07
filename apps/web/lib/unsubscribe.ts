import { decodeUnsubscribeToken } from "@senlo/core/src/unsubscribe-token";
import {
  ContactRepository,
  CampaignRepository,
  SuppressionRepository,
  db,
} from "@senlo/db";

export type UnsubscribeOutcome =
  | { ok: true; alreadyUnsubscribed: boolean }
  | { ok: false; reason: "invalid" | "not_found" };

/**
 * Shared by the unsubscribe page and by the one-click POST endpoint that
 * List-Unsubscribe-Post points at, so both routes behave identically.
 *
 * A campaign recipient is always a contact. A triggered recipient may not be:
 * the public API can send to any address. Those are recorded on the project's
 * suppression list instead, which is what the sender already checks before
 * every send.
 */
export async function processUnsubscribe(
  token: string,
): Promise<UnsubscribeOutcome> {
  const data = decodeUnsubscribeToken(token);
  if (!data) return { ok: false, reason: "invalid" };

  const contactRepo = new ContactRepository(db);
  const campaignRepo = new CampaignRepository(db);
  const suppressionRepo = new SuppressionRepository(db);

  let projectId = data.projectId;
  if (!projectId) {
    const campaign = await campaignRepo.findById(data.campaignId);
    projectId = campaign?.projectId;
  }

  let contact =
    data.contactId !== undefined
      ? await contactRepo.findById(data.contactId)
      : null;

  if (!contact && data.email && projectId) {
    contact = await contactRepo.findByEmail(projectId, data.email);
  }

  const email = contact?.email ?? data.email;
  if (!email) return { ok: false, reason: "not_found" };

  if (contact?.unsubscribed) {
    return { ok: true, alreadyUnsubscribed: true };
  }

  if (contact) {
    await contactRepo.unsubscribe(contact.id);
  } else if (projectId) {
    const existing = await suppressionRepo.findByProjectAndEmail(
      projectId,
      email,
    );
    if (existing) return { ok: true, alreadyUnsubscribed: true };

    await suppressionRepo.create({
      projectId,
      email,
      reason: "UNSUBSCRIBE",
    });
  } else {
    return { ok: false, reason: "not_found" };
  }

  await campaignRepo.logEvent({
    campaignId: data.campaignId,
    contactId: contact?.id ?? null,
    email,
    type: "UNSUBSCRIBE",
  });

  return { ok: true, alreadyUnsubscribed: false };
}
