import type { Campaign, TriggeredSendLog } from "@senlo/core";
import { repositories } from "apps/web/lib/services";

const campaignRepo = repositories.campaigns;
const contactRepo = repositories.contacts;
const logRepo = repositories.sendLogs;
const suppressionRepo = repositories.suppressions;

export interface WebhookScope {
  campaign: Campaign | null;
  logEntry: TriggeredSendLog | null;
  contactId: number | null;
}

/**
 * Resolves what a provider event refers to, inside one project only.
 *
 * The project comes from the event's tag and is what the signature or secret
 * was checked against. Everything else in the event - message id, campaign
 * id, contact id - is matched globally by the repositories, so each one is
 * kept only if it belongs to that project. Without this, a tenant with a
 * valid webhook secret could tag events with another tenant's campaign and
 * write bounces and deliveries into it.
 */
export async function scopeWebhookEvent(
  projectId: number,
  event: {
    providerMessageId: string;
    campaignId: number | null;
    contactId: number | null;
    email: string;
  },
): Promise<WebhookScope> {
  const inProject = (campaign: Campaign | null) =>
    campaign && campaign.projectId === projectId ? campaign : null;

  let campaign = event.campaignId
    ? inProject(await campaignRepo.findById(event.campaignId))
    : null;

  let logEntry = await logRepo.findByProviderMessageId(event.providerMessageId);
  if (logEntry) {
    const logCampaign =
      campaign?.id === logEntry.campaignId
        ? campaign
        : inProject(await campaignRepo.findById(logEntry.campaignId));
    if (!logCampaign) {
      logEntry = null;
    } else {
      campaign ??= logCampaign;
    }
  }

  if (!logEntry && campaign) {
    logEntry = await logRepo.findLatestByCampaignAndEmail(campaign.id, event.email);
  }

  let contactId: number | null = null;
  if (event.contactId) {
    const contact = await contactRepo.findById(event.contactId);
    if (contact && contact.projectId === projectId) contactId = contact.id;
  }

  return { campaign, logEntry, contactId };
}

/** Adds the address to the project's suppression list once. */
export async function suppressOnce(
  projectId: number,
  email: string,
  reason: "BOUNCE" | "SPAM",
) {
  const existing = await suppressionRepo.findByProjectAndEmail(projectId, email);
  if (!existing) {
    await suppressionRepo.create({ projectId, email, reason });
  }
}
