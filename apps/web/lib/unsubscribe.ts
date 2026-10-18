import { decodeUnsubscribeToken } from "@senlo/core";
import { getConfig } from "./config";
import { repositories } from "apps/web/lib/services";

export type UnsubscribeOutcome =
  | { ok: true; alreadyUnsubscribed: boolean }
  | { ok: false; reason: "invalid" | "not_found" | "confirm_email" };

const sameAddress = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Shared by the unsubscribe page and by the one-click POST endpoint that
 * List-Unsubscribe-Post points at, so both routes behave identically.
 *
 * A campaign recipient is always a contact. A triggered recipient may not be:
 * the public API can send to any address. Those are recorded on the project's
 * suppression list instead, which is what the sender already checks before
 * every send.
 *
 * Signed tokens act at once. A legacy unsigned token - from mail sent before
 * tokens were signed - could have been edited by anyone, so it acts only when
 * `confirmEmail` matches the recipient's address; without it the result is
 * `confirm_email` and the page asks for it. Every id in the token must also
 * agree on one project: the contact's, the campaign's and the token's own.
 */
export async function processUnsubscribe(
  token: string,
  options: { confirmEmail?: string } = {},
): Promise<UnsubscribeOutcome> {
  const decoded = await decodeUnsubscribeToken(token, getConfig().linkSigningSecret);
  if (!decoded) return { ok: false, reason: "invalid" };

  const { data, signed } = decoded;
  if (!signed && !options.confirmEmail) {
    return { ok: false, reason: "confirm_email" };
  }

  const contactRepo = repositories.contacts;
  const campaignRepo = repositories.campaigns;
  const suppressionRepo = repositories.suppressions;

  const campaign = await campaignRepo.findById(data.campaignId);
  if (campaign && data.projectId && campaign.projectId !== data.projectId) {
    return { ok: false, reason: "invalid" };
  }
  const projectId = data.projectId ?? campaign?.projectId;

  let contact =
    data.contactId !== undefined
      ? await contactRepo.findById(data.contactId)
      : null;

  if (contact && projectId && contact.projectId !== projectId) {
    return { ok: false, reason: "invalid" };
  }

  if (!contact && data.email && projectId) {
    contact = await contactRepo.findByEmail(projectId, data.email);
  }

  const email = contact?.email ?? data.email;
  if (!email) return { ok: false, reason: "not_found" };

  // The same answer as an unknown recipient, so the form cannot be used to
  // test which address sits behind a contact id.
  if (!signed && !sameAddress(email, options.confirmEmail ?? "")) {
    return { ok: false, reason: "not_found" };
  }

  if (contact?.unsubscribed) {
    return { ok: true, alreadyUnsubscribed: true };
  }

  const recipientProjectId = contact?.projectId ?? projectId;

  if (contact) {
    await contactRepo.unsubscribe(contact.id);
  } else if (recipientProjectId) {
    const existing = await suppressionRepo.findByProjectAndEmail(
      recipientProjectId,
      email,
    );
    if (existing) return { ok: true, alreadyUnsubscribed: true };

    await suppressionRepo.create({
      projectId: recipientProjectId,
      email,
      reason: "UNSUBSCRIBE",
    });
  } else {
    return { ok: false, reason: "not_found" };
  }

  // Only onto a campaign of the recipient's own project.
  if (campaign && campaign.projectId === recipientProjectId) {
    await campaignRepo.logEvent({
      campaignId: campaign.id,
      contactId: contact?.id ?? null,
      email,
      type: "UNSUBSCRIBE",
    });
  }

  return { ok: true, alreadyUnsubscribed: false };
}
