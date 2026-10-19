// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MailSettings } from "../config";
import type { ICampaignRepository, IEmailTemplateRepository } from "../ports";
import { escapeAttr } from "../renderer/escape";
import { openTrackingToken, verifyClickSignature } from "../tracking-token";

export interface TrackingMetadata {
  userAgent: string;
  ip: string;
}

export type ClickResolution =
  /** Signed token and destination: record the click and redirect. */
  | { follow: true; campaignId: number; email: string }
  /** Anything unverified: show the destination, record nothing. */
  | { follow: false };

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

/**
 * Opens and clicks from tracking links. Tokens are sealed, so a forged one
 * resolves to nothing; links from mail sent before signing are vouched for
 * only by appearing in the campaign's own templates.
 */
export class TrackingService {
  constructor(
    private readonly repos: {
      campaigns: Pick<ICampaignRepository, "logEvent" | "findById">;
      templates: Pick<IEmailTemplateRepository, "findById">;
    },
    private readonly settings: Pick<MailSettings, "linkSigningSecret">,
  ) {}

  /** The recipient behind an open-pixel token, or null for a forged one. */
  resolveOpen(token: string) {
    return openTrackingToken(token, this.settings.linkSigningSecret);
  }

  async resolveClick(token: string, url: string, signature: string): Promise<ClickResolution> {
    const secret = this.settings.linkSigningSecret;
    const [recipient, signed] = await Promise.all([
      openTrackingToken(token, secret),
      verifyClickSignature(token, url, signature, secret),
    ]);
    if (!recipient || !signed || !isHttpUrl(url)) return { follow: false };
    return { follow: true, campaignId: recipient.campaignId, email: recipient.email };
  }

  /**
   * For click links from mail sent before signing: whether the destination
   * stands in one of the campaign's templates (raw or attribute-escaped). A
   * destination built from a merge tag is not there and is not followed,
   * which is the safe direction to be wrong in.
   */
  async isLegacyClickTarget(campaignId: number, url: string): Promise<boolean> {
    if (!isHttpUrl(url) || !Number.isInteger(campaignId) || campaignId <= 0) return false;

    const campaign = await this.repos.campaigns.findById(campaignId);
    if (!campaign) return false;

    const templateIds = new Set<number>([
      campaign.templateId,
      ...Object.values(campaign.localeTemplates ?? {}),
    ]);
    for (const templateId of templateIds) {
      const template = await this.repos.templates.findById(Number(templateId));
      if (
        template &&
        template.projectId === campaign.projectId &&
        (template.html.includes(url) || template.html.includes(escapeAttr(url)))
      ) {
        return true;
      }
    }
    return false;
  }

  /** Records an email open. Never throws: the pixel must not depend on it. */
  async trackOpen(campaignId: number, email: string, metadata: TrackingMetadata) {
    try {
      await this.repos.campaigns.logEvent({
        campaignId,
        email,
        type: "OPEN",
        metadata: { userAgent: metadata.userAgent, ip: metadata.ip },
      });
      return { success: true as const };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Records a link click. Never throws: the redirect must not depend on it. */
  async trackClick(campaignId: number, email: string, linkUrl: string, metadata: TrackingMetadata) {
    try {
      await this.repos.campaigns.logEvent({
        campaignId,
        email,
        type: "CLICK",
        linkUrl,
        metadata: { userAgent: metadata.userAgent, ip: metadata.ip },
      });
      return { success: true as const };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
