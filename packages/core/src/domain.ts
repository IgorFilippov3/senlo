export interface Project {
  id: number;
  userId?: string | null;
  name: string;
  description?: string | null;
  providerId?: number | null;
  aiProviderId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  id: number;
  projectId: number;
  email: string;
  name?: string | null;
  meta?: Record<string, unknown> | null;
  unsubscribed: boolean;
  unsubscribedAt?: Date | null;
  createdAt: Date;
}

export interface RecipientList {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  createdAt: Date;
}

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type CampaignType = "STANDARD" | "TRIGGERED";

export interface Campaign {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  type: CampaignType;
  status: CampaignStatus;

  // Sender info
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;

  // Email content override
  subject?: string | null;
  preheader?: string | null;

  templateId: number;
  listId?: number | null;
  variablesSchema?: Record<string, any> | null;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignEventType =
  | "SENT"
  | "DELIVERED"
  | "OPEN"
  | "CLICK"
  | "BOUNCE"
  | "SPAM_REPORT"
  | "UNSUBSCRIBE"
  | "FAILED";

export interface CampaignEvent {
  id: number;
  campaignId: number;
  contactId?: number | null;
  email: string;
  type: CampaignEventType;
  linkUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: Date;
}

export type EmailProviderType = "RESEND" | "MAILGUN";

export interface EmailProvider {
  id: number;
  userId?: string | null;
  name: string;
  type: EmailProviderType;
  config: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AiProviderType = "OPENAI" | "ANTHROPIC";

export interface AiProvider {
  id: number;
  userId?: string | null;
  name: string;
  type: AiProviderType;
  config: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: number;
  projectId: number;
  name: string;
  key: string;
  lastUsedAt?: Date | null;
  createdAt: Date;
}

export interface TriggeredSendLog {
  id: number;
  campaignId: number;
  email: string;
  status: "SUCCESS" | "FAILED";
  error?: string | null;
  data?: Record<string, any> | null;
  sentAt: Date;
}

export interface SavedRow {
  id: number;
  userId: string;
  projectId?: number | null;
  name: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}
