import type {
  Project,
  Contact,
  RecipientList,
  Campaign,
  CampaignStatus,
  CampaignEvent,
  CampaignEventType,
} from "./domain";
import type { EmailTemplate } from "./emailTemplate";

// ============================================================
// Mailer Interface
// ============================================================

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IMailer {
  send(options: SendMailOptions): Promise<SendMailResult>;
}

export interface IProjectRepository {
  create(data: {
    name: string;
    description?: string | null;
    userId?: string | null;
  }): Promise<Project>;

  findById(id: number): Promise<Project | null>;

  findAll(): Promise<Project[]>;

  findByUser(userId: string): Promise<Project[]>;
}

export interface IEmailTemplateRepository {
  create(data: {
    projectId: number;
    name: string;
    subject: string;
    html: string;
    designJson?: unknown;
  }): Promise<EmailTemplate>;

  findById(id: number): Promise<EmailTemplate | null>;
  findByProject(projectId: number): Promise<EmailTemplate[]>;
}

export interface ContactRepository {
  upsert(data: {
    projectId: number;
    email: string;
    name?: string | null;
  }): Promise<Contact>;

  findByProject(projectId: number): Promise<Contact[]>;
}

export interface RecipientListRepository {
  create(data: {
    projectId: number;
    name: string;
    description?: string | null;
  }): Promise<RecipientList>;

  addContacts(listId: number, contactIds: number[]): Promise<void>;

  findByProject(projectId: number): Promise<RecipientList[]>;
}

export interface ICampaignRepository {
  create(data: Omit<Campaign, "id" | "createdAt" | "updatedAt">): Promise<Campaign>;
  findById(id: number): Promise<Campaign | null>;
  findByProject(projectId: number): Promise<Campaign[]>;
  update(
    id: number,
    data: Partial<Omit<Campaign, "id" | "projectId" | "createdAt" | "updatedAt">>
  ): Promise<Campaign | null>;
  delete(id: number): Promise<void>;

  // Event logging
  logEvent(data: Omit<CampaignEvent, "id" | "occurredAt">): Promise<CampaignEvent>;
  getEventsByCampaign(campaignId: number): Promise<CampaignEvent[]>;
}
