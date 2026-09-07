export type EmailJobData = {
  projectId: number;
  campaignId: number;
  contactId: number | null;
  logId?: number | null;
  email: string;
  from: string;
  subject: string;
  /**
   * The finished message. Only set by senders that cannot describe the render -
   * a template with no designJson - and by jobs queued before rendering moved
   * into this worker.
   */
  html?: string;
  /**
   * What to render, instead of the result. A campaign for a hundred thousand
   * recipients used to put a hundred thousand copies of the same HTML into
   * Redis; now each job carries an id and this recipient's merge tag values.
   */
  templateId?: number;
  renderData?: Record<string, any>;
  baseUrl?: string;
  preheader?: string;
  title?: string;
  unsubscribePageUrl?: string;
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
