import type { EmailDesignDocument } from "./emailDesign";

export type EmailTemplateStatus = "draft" | "published";

export interface EmailTemplate {
  id: number;
  projectId: number;
  name: string;
  subject: string;
  /** Hidden preview text shown by inboxes next to the subject line. */
  preheader: string | null;
  html: string;
  designJson: EmailDesignDocument | null;
  createdAt: Date;
  updatedAt: Date;
  status: EmailTemplateStatus;
  locale: string;
}

export interface CreateEmailTemplateInput {
  projectId: number;
  name: string;
  subject: string;
  preheader?: string | null;
  html: string;
  designJson: EmailDesignDocument | null;
  locale?: string;
}

export interface UpdateEmailTemplateInput {
  id: number;
  name?: string;
  subject?: string;
  preheader?: string | null;
  html?: string;
  designJson?: EmailDesignDocument | null;
  status?: EmailTemplateStatus;
  locale?: string;
}
