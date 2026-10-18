import { NextRequest, NextResponse } from "next/server";
import { CampaignRepository, EmailTemplateRepository, db } from "@senlo/db";
import { escapeAttr } from "@senlo/core";
import { confirmLeavingResponse } from "apps/web/lib/tracking";

const campaignRepo = new CampaignRepository(db);
const templateRepo = new EmailTemplateRepository(db);

/**
 * Click link from mail sent before tracking links were signed. Its `url` was
 * never signed, so following it blindly made this an open redirect. It now
 * redirects only to a destination that appears in one of the campaign's
 * templates; anything else is shown on a page instead of followed. Clicks are
 * no longer recorded here, since the campaign and address are not verified.
 * New mail uses `/api/t/c/[token]`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; email: string }> },
) {
  const { campaignId } = await params;
  const url = new URL(request.url).searchParams.get("url");

  if (!url) {
    return new NextResponse("Invalid request", { status: 400 });
  }

  if (/^https?:\/\//i.test(url) && (await appearsInCampaign(Number(campaignId), url))) {
    return NextResponse.redirect(url);
  }

  return confirmLeavingResponse(url);
}

async function appearsInCampaign(campaignId: number, url: string) {
  if (!Number.isInteger(campaignId) || campaignId <= 0) return false;

  const campaign = await campaignRepo.findById(campaignId);
  if (!campaign) return false;

  const templateIds = new Set<number>([
    campaign.templateId,
    ...Object.values(campaign.localeTemplates ?? {}),
  ]);

  for (const templateId of templateIds) {
    const template = await templateRepo.findById(Number(templateId));
    // Same project only, and the URL as it stands in the stored HTML: raw or
    // attribute-escaped. A destination built from a merge tag is not there
    // and gets the page instead, which is the safe direction to be wrong in.
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
