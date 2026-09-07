export type EmailJobData = {
  projectId: number;
  campaignId: number;
  contactId: number | null;
  logId?: number | null;
  email: string;
  from: string;
  subject: string;
  html: string;
  providerId: number;
  replyTo?: string;
  /**
   * One-click unsubscribe endpoint for this recipient. The List-Unsubscribe
   * headers are built at send time rather than here, so the job stays small.
   */
  unsubscribeOneClickUrl?: string;
};

export type CampaignJobData = {
  campaignId: number;
  userId: string;
};

export type AutomationJobData = {
  executionId: number;
  nodeId: string;
};
