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
};

export type CampaignJobData = {
  campaignId: number;
  userId: string;
};

export type AutomationJobData = {
  executionId: number;
  nodeId: string;
};
