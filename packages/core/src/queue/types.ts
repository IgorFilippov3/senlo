export type EmailJobData = {
  campaignId: number;
  contactId: number;
  email: string;
  from: string;
  subject: string;
  html: string;
  providerId: number;
};

export type CampaignJobData = {
  campaignId: number;
  userId: string;
};
