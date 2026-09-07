import {
  ICampaignRepository,
  IEmailTemplateRepository,
  IEmailProviderRepository,
  IProjectRepository,
  ITriggeredSendLogRepository,
} from "../ports";
import { replaceMergeTags } from "../merge-tags";
import {
  encodeUnsubscribeToken,
  buildUnsubscribeHeaders,
  unsubscribeUrls,
} from "../unsubscribe-token";
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

    // A triggered recipient may have no contact row, so the token carries the
    // project and the address. Without this the unsubscribe tag rendered as
    // "#" and the link did nothing.
    const unsubscribeToken = encodeUnsubscribeToken({
      projectId: project.id,
      email: to,
      campaignId: campaign.id,
    });
    const unsubscribe = unsubscribeUrls(baseUrl, unsubscribeToken);

    const fromAddress = campaign.fromName
      ? `${campaign.fromName} <${campaign.fromEmail || "hello@senlo.io"}>`
      : campaign.fromEmail || "hello@senlo.io";

    // Prepare subject with merge tags support
    const rawSubject = subjectOverride || template.subject;
    // A subject line is plain text, so HTML escaping would show entities to
    // the recipient.
    const personalizedSubject = replaceMergeTags(
      rawSubject,
      {
        custom: data,
        contact: { email: to, ...data },
        project: { name: project.name },
      },
      undefined,
      { escape: false },
    );

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
        providerId: project.providerId,
        replyTo: campaign.replyTo || undefined,
        // Rendering happens in the send worker, the same as for a campaign, so
        // the job carries what to render rather than the rendered message.
        templateId: template.id,
        baseUrl,
        preheader: campaign.preheader || template.preheader || undefined,
        title: subjectOverride || template.subject,
        renderData: {
          custom: data,
          contact: { email: to, ...data },
          unsubscribeUrl: unsubscribe.page,
        },
        unsubscribePageUrl: unsubscribe.page,
        unsubscribeOneClickUrl: unsubscribe.oneClick,
        html: template.designJson ? undefined : template.html,
      },
    );

    return {
      success: true,
      jobId: job.id,
      logId: log.id,
    };
  }
}
