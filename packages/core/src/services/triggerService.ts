import {
  ICampaignRepository,
  IEmailTemplateRepository,
  IEmailProviderRepository,
  IProjectRepository,
  ITriggeredSendLogRepository,
} from "../ports";
import {
  renderEmailDesign,
  wrapLinksWithTracking,
  EmailDesignDocument,
  replaceMergeTags,
} from "../index";
import { Queue } from "bullmq";

export interface TriggeredEmailOptions {
  campaignId: number;
  projectId: number; // For security validation
  to: string;
  data?: Record<string, unknown>;
  locale?: string;
  subject?: string;
  baseUrl: string;
}

export class TriggerService {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly templateRepo: IEmailTemplateRepository,
    private readonly providerRepo: IEmailProviderRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly logRepo: ITriggeredSendLogRepository,
    private readonly emailQueue: Queue,
  ) {}

  async sendTriggeredEmail(options: TriggeredEmailOptions) {
    const { campaignId, to, data, locale, subject: subjectOverride, baseUrl } = options;

    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.projectId !== options.projectId) {
      throw new Error("Campaign not found");
    }

    if (campaign.type !== "TRIGGERED") {
      throw new Error("This campaign is not configured for API triggers");
    }

    // Locale-based template selection
    let templateId = campaign.templateId;
    if (
      locale &&
      campaign.localeTemplates &&
      campaign.localeTemplates[locale]
    ) {
      templateId = campaign.localeTemplates[locale];
    }

    const [template, project] = await Promise.all([
      this.templateRepo.findById(templateId),
      this.projectRepo.findById(campaign.projectId),
    ]);

    if (!template) throw new Error("Template not found");
    if (!project) throw new Error("Project not found");
    
    if (!project.providerId) {
      throw new Error("No email provider configured for this project");
    }

    const provider = await this.providerRepo.findById(project.providerId);
    if (!provider) {
      throw new Error("Email provider not found");
    }

    const emailEncoded = encodeURIComponent(to);
    const openTrackingUrl = `${baseUrl}/api/track/open/${campaign.id}/${emailEncoded}`;
    const trackingPixel = `<img src="${openTrackingUrl}" width="1" height="1" style="display:none !important;" alt="" />`;
    const clickTrackingBaseUrl = `${baseUrl}/api/track/click/${campaign.id}/${emailEncoded}`;

    let personalizedHtml = template.designJson
      ? renderEmailDesign(template.designJson as EmailDesignDocument, {
          baseUrl,
          data: {
            custom: data,
            contact: { email: to, ...data },
            unsubscribeUrl: "#",
          },
        })
      : template.html;

    personalizedHtml = wrapLinksWithTracking(
      personalizedHtml,
      clickTrackingBaseUrl,
    );

    personalizedHtml += trackingPixel;

    const fromAddress = campaign.fromName
      ? `${campaign.fromName} <${campaign.fromEmail || "hello@senlo.io"}>`
      : campaign.fromEmail || "hello@senlo.io";

    // Prepare subject with merge tags support
    const rawSubject = subjectOverride || template.subject;
    const personalizedSubject = replaceMergeTags(rawSubject, {
      custom: data,
      contact: { email: to, ...data },
      project: { name: project.name },
    });

    const log = await this.logRepo.create({
      campaignId: campaign.id,
      email: to,
      status: "PENDING",
      error: null,
      data: data,
    });

    const job = await this.emailQueue.add(
      `triggered-${campaign.id}-${to}-${Date.now()}`,
      {
        projectId: project.id,
        campaignId: campaign.id,
        contactId: null,
        logId: log.id,
        email: to,
        from: fromAddress,
        subject: personalizedSubject,
        html: personalizedHtml,
        providerId: project.providerId,
        replyTo: campaign.replyTo || undefined,
      },
    );

    return {
      success: true,
      jobId: job.id,
      logId: log.id,
    };
  }
}
