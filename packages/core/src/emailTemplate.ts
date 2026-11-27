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

/**
 * Where a template version came from: the editor, API v1, the MCP server
 * (API v1 with a `Senlo-Client: mcp/...` label), or `baseline`: the content
 * a template already had when versions began, kept on its first save.
 */
export const TEMPLATE_VERSION_SOURCES = ["editor", "api", "mcp", "baseline"] as const;
export type TemplateVersionSource = (typeof TEMPLATE_VERSION_SOURCES)[number];

/** Who saved a version; null when not known (a baseline, a deleted user or key). */
export type TemplateVersionAuthor =
  | { kind: "user"; userId: string; name: string | null; email: string }
  | { kind: "apiKey"; apiKeyId: number; name: string; prefix: string }
  | null;

/** A version in the history list: everything but the design. */
export interface EmailTemplateVersionSummary {
  id: number;
  templateId: number;
  /** 1, 2, 3 … per template. */
  version: number;
  subject: string;
  preheader: string | null;
  source: TemplateVersionSource;
  author: TemplateVersionAuthor;
  createdAt: Date;
}

/** One saved state of a template's content, as it can be restored. */
export interface EmailTemplateVersion extends EmailTemplateVersionSummary {
  design: EmailDesignDocument;
}

export interface NewEmailTemplateVersion {
  templateId: number;
  design: EmailDesignDocument;
  subject: string;
  preheader: string | null;
  source: TemplateVersionSource;
  createdByUserId?: string | null;
  createdByApiKeyId?: number | null;
}
