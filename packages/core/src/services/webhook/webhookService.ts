// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Campaign, TriggeredSendLog } from "../../domain";
import { consoleLogger, type Logger } from "../../logger";
import type {
  ContactRepository,
  ICampaignRepository,
  IEmailProviderRepository,
  IProjectRepository,
  ISuppressionRepository,
  ITriggeredSendLogRepository,
} from "../../ports";
import { postmarkWebhookAdapter } from "./postmark";
import { resendWebhookAdapter } from "./resend";
import type {
  DeliveryEvent,
  WebhookAdapter,
  WebhookProviderType,
  WebhookResult,
} from "./types";

export interface WebhookServiceRepositories {
  campaigns: ICampaignRepository;
  contacts: ContactRepository;
  projects: IProjectRepository;
  providers: IEmailProviderRepository;
  sendLogs: ITriggeredSendLogRepository;
  suppressions: ISuppressionRepository;
}

interface EventScope {
  campaign: Campaign | null;
  logEntry: TriggeredSendLog | null;
  contactId: number | null;
}

/**
 * Receives provider callbacks (deliveries, bounces, complaints, opens,
 * clicks), authenticates them against the project's provider and writes the
 * outcome: send-log status, campaign event, suppression.
 *
 * The HTTP layer only passes the raw body and headers in and maps the result
 * to a status code; everything a provider's format implies lives in its
 * adapter.
 */
export class WebhookService {
  private readonly adapters: ReadonlyMap<WebhookProviderType, WebhookAdapter>;

  constructor(
    private readonly repos: WebhookServiceRepositories,
    private readonly logger: Logger = consoleLogger,
    adapters: WebhookAdapter[] = [resendWebhookAdapter, postmarkWebhookAdapter],
  ) {
    this.adapters = new Map(adapters.map((a) => [a.type, a]));
  }

  async handle(
    providerType: WebhookProviderType,
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookResult> {
    const adapter = this.adapters.get(providerType);
    if (!adapter) throw new Error(`No webhook adapter for ${providerType}`);

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      this.logger.error("Webhook payload is not JSON", { provider: providerType });
      return { status: "rejected", reason: "invalid_payload" };
    }

    // The project tag picks whose secret the event is checked against. Until
    // the check passes nothing else in the body is trusted.
    const projectId = adapter.readProjectId(body);
    if (!projectId) {
      this.logger.warn("Webhook without a project tag", { provider: providerType });
      return { status: "ignored", reason: "no_project" };
    }

    const project = await this.repos.projects.findById(projectId);
    if (!project?.providerId) {
      this.logger.warn("Webhook for an unknown project or one without a provider", {
        provider: providerType,
        projectId,
      });
      return { status: "ignored", reason: "unknown_project" };
    }

    const provider = await this.repos.providers.findById(project.providerId);
    if (!provider || provider.type !== providerType) {
      this.logger.warn("Webhook provider does not match the project's provider", {
        provider: providerType,
        projectId,
      });
      return { status: "ignored", reason: "provider_mismatch" };
    }

    // Without a secret anyone could post bounces and fill the suppression
    // list, so an unconfigured secret refuses every event rather than
    // accepting them all.
    const secret = provider.config.webhook_secret;
    if (typeof secret !== "string" || !secret) {
      this.logger.error("Webhook secret is not configured for the provider", {
        provider: providerType,
        providerId: provider.id,
      });
      return { status: "rejected", reason: "secret_not_configured" };
    }

    const verified = adapter.verify(rawBody, lowerCaseKeys(headers), secret);
    if (verified === null) {
      this.logger.error("Webhook verification failed", {
        provider: providerType,
        providerId: provider.id,
      });
      return { status: "rejected", reason: "invalid_signature" };
    }

    const event = adapter.normalize(verified);
    if (!event) {
      this.logger.debug("Webhook event not tracked or incomplete", {
        provider: providerType,
        projectId,
      });
      return { status: "ignored", reason: "untracked_event" };
    }

    await this.apply(projectId, event);
    return { status: "processed", event };
  }

  /** Writes a verified event that belongs to `projectId`. */
  async apply(projectId: number, event: DeliveryEvent): Promise<void> {
    const { campaign, logEntry, contactId } = await this.scope(projectId, event);
    const rawKey = `${event.provider.toLowerCase()}_event`;

    switch (event.type) {
      case "DELIVERED":
      case "BOUNCE":
      case "SPAM_REPORT": {
        if (logEntry) {
          await this.repos.sendLogs.update(logEntry.id, {
            status:
              event.type === "BOUNCE"
                ? "BOUNCED"
                : event.type === "SPAM_REPORT"
                  ? "COMPLAINED"
                  : "DELIVERED",
            data: { ...logEntry.data, [rawKey]: event.raw },
          });
        }
        if (campaign) {
          await this.repos.campaigns.logEvent({
            campaignId: campaign.id,
            contactId,
            email: event.email,
            type: event.type,
            metadata: { [rawKey]: event.raw },
          });
        }
        if (event.type !== "DELIVERED") {
          this.logger.info("Suppressing an address after a provider event", {
            projectId,
            reason: event.type,
          });
          await this.suppressOnce(
            projectId,
            event.email,
            event.type === "BOUNCE" ? "BOUNCE" : "SPAM",
          );
        }
        return;
      }
      case "OPEN":
      case "CLICK": {
        if (campaign) {
          await this.repos.campaigns.logEvent({
            campaignId: campaign.id,
            contactId,
            email: event.email,
            type: event.type,
            metadata: { [rawKey]: event.raw, url: event.url },
          });
        }
        return;
      }
    }
  }

  /**
   * Resolves what the event refers to, inside one project only.
   *
   * The project is what the signature or secret was checked against. The
   * message id, campaign id and contact id are matched globally by the
   * repositories, so each is kept only if it belongs to that project.
   * Without this, a tenant with a valid secret could tag events with another
   * tenant's campaign and write bounces and deliveries into it.
   */
  private async scope(projectId: number, event: DeliveryEvent): Promise<EventScope> {
    const { campaigns, sendLogs, contacts } = this.repos;
    const inProject = (campaign: Campaign | null) =>
      campaign && campaign.projectId === projectId ? campaign : null;

    let campaign = event.campaignId
      ? inProject(await campaigns.findById(event.campaignId))
      : null;

    let logEntry = await sendLogs.findByProviderMessageId(event.providerMessageId);
    if (logEntry) {
      const logCampaign =
        campaign?.id === logEntry.campaignId
          ? campaign
          : inProject(await campaigns.findById(logEntry.campaignId));
      if (!logCampaign) {
        logEntry = null;
      } else {
        campaign ??= logCampaign;
      }
    }

    if (!logEntry && campaign) {
      logEntry = await sendLogs.findLatestByCampaignAndEmail(campaign.id, event.email);
    }

    let contactId: number | null = null;
    if (event.contactId) {
      const contact = await contacts.findById(event.contactId);
      if (contact && contact.projectId === projectId) contactId = contact.id;
    }

    return { campaign, logEntry, contactId };
  }

  /** Adds the address to the project's suppression list once. */
  private async suppressOnce(
    projectId: number,
    email: string,
    reason: "BOUNCE" | "SPAM",
  ): Promise<void> {
    const existing = await this.repos.suppressions.findByProjectAndEmail(projectId, email);
    if (!existing) {
      await this.repos.suppressions.create({ projectId, email, reason });
    }
  }
}

function lowerCaseKeys(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = value;
  return out;
}
