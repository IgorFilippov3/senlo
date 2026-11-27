// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { API_PERMISSIONS } from "../api-principal";
import { emailDesignDocumentSchema } from "../emailDesign";
import type { EmailTemplate } from "../emailTemplate";

/**
 * Request and response shapes of API v1. The routes answer with these and
 * the OpenAPI spec (`./openapi.ts`) is generated from them, so the two cannot
 * drift. Contract: `senlo-managed/docs/api-v1-contract.md`.
 */

/** `error.code` values of API v1. More are added with the routes that need them. */
export const API_V1_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNKNOWN_FIELD",
  "UNAUTHORIZED",
  "QUOTA_EXCEEDED",
  "PERMISSION_REQUIRED",
  "RECIPIENT_NOT_ALLOWED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "IDEMPOTENCY_KEY_REUSED",
  "IDEMPOTENCY_IN_PROGRESS",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "INTERNAL_ERROR",
] as const;
export type ApiV1ErrorCode = (typeof API_V1_ERROR_CODES)[number];

export const ApiIssueSchema = z.object({
  path: z.string().describe("Path to the field, e.g. design.rows[2].columns[0].blocks[1].props.href; empty for the whole body."),
  code: z.string().describe("zod issue code: invalid_type, too_small, unrecognized_keys, ..."),
  message: z.string(),
});

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_V1_ERROR_CODES),
    message: z.string(),
    hint: z.string().optional().describe("What to do next. Written for coding agents."),
    issues: z.array(ApiIssueSchema).optional().describe("Invalid fields, at most 20."),
    issueCount: z.number().int().optional().describe("All invalid fields, when there are more than in issues."),
    details: z.record(z.unknown()).optional(),
    requestId: z.string().describe("Also in the X-Request-Id header. Quote it when asking for support."),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;

/** Every successful v1 response: `{ "data": ... }`. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

export const ApiMeSchema = z.object({
  project: z.object({ id: z.number().int(), name: z.string() }),
  permissions: z.array(z.enum(API_PERMISSIONS)),
  auth: z.object({
    source: z.enum(["api_key", "oauth"]),
    apiKey: z
      .object({ id: z.number().int(), name: z.string(), prefix: z.string() })
      .nullable()
      .describe("The key behind the request; null for an OAuth token."),
    client: z.string().nullable().describe("The Senlo-Client header the request was sent with."),
  }),
  instance: z.object({
    edition: z.enum(["cloud", "self-hosted"]),
    apiVersion: z.literal("v1"),
  }),
});
export type ApiMe = z.infer<typeof ApiMeSchema>;

// ---------------------------------------------------------------- templates

/**
 * A design document in the spec. The routes check it with the real schema
 * (`emailDesignDocumentSchema`); the spec names it only, because the full
 * block schema is what `GET /api/v1/guide` documents, with examples.
 */
export const ApiDesignDocSchema = z
  .record(z.unknown())
  .describe("An EmailDesignDocument: { version, rows, settings }. GET /api/v1/guide documents the blocks.");

const templateFields = {
  name: z.string().trim().min(1, "Name is required").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(255),
  preheader: z.string().max(255).nullable(),
  locale: z.string().trim().min(2).max(35),
};

/** `POST /api/v1/templates`. */
export const ApiCreateTemplateSchema = z
  .object({
    name: templateFields.name,
    subject: templateFields.subject,
    preheader: templateFields.preheader.optional(),
    locale: templateFields.locale.optional(),
    design: emailDesignDocumentSchema,
  })
  .strict();

const updateTemplateObject = z
  .object({
    name: templateFields.name.optional(),
    subject: templateFields.subject.optional(),
    preheader: templateFields.preheader.optional(),
    locale: templateFields.locale.optional(),
    design: emailDesignDocumentSchema.optional(),
  })
  .strict();

/** `PATCH /api/v1/templates/{id}`: what is sent changes; `design` replaces the whole document. */
export const ApiUpdateTemplateSchema = updateTemplateObject.refine((v) => Object.keys(v).length > 0, {
  message: "Send at least one field to change: name, subject, preheader, locale or design.",
});

/** Merge-tag values for previews and test sends: what a trigger's API call would send. */
const ApiVariablesSchema = z
  .record(z.unknown())
  .describe("Values for the template's {{variables}}, as a trigger send would pass them.");

const previewObject = z
  .object({
    templateId: z.number().int().positive().optional(),
    design: emailDesignDocumentSchema.optional(),
    subject: z.string().max(255).optional(),
    preheader: z.string().max(255).nullable().optional(),
    data: ApiVariablesSchema.optional(),
  })
  .strict();

/** `POST /api/v1/templates/preview`: a saved template, or an unsaved design. */
export const ApiPreviewTemplateSchema = previewObject.refine((v) => (v.templateId === undefined) !== (v.design === undefined), {
  message: "Send either templateId (a saved template) or design (an unsaved one), not both.",
});

/** `POST /api/v1/templates/{id}/test-send`. */
export const ApiTestSendSchema = z
  .object({
    to: z.string().trim().email("Enter a single valid recipient address."),
    from: z.string().trim().email("Enter a single valid sender address.").optional(),
    data: ApiVariablesSchema.optional(),
  })
  .strict();

const isoDate = z.string().describe("ISO 8601 date-time.");

export const ApiTemplateSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  subject: z.string(),
  preheader: z.string().nullable(),
  locale: z.string(),
  status: z.string(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type ApiTemplateSummary = z.infer<typeof ApiTemplateSummarySchema>;

export const ApiTemplateSchema = ApiTemplateSummarySchema.extend({ design: ApiDesignDocSchema });
export type ApiTemplate = z.infer<typeof ApiTemplateSchema>;

export const ApiTemplatePreviewSchema = z.object({
  subject: z.string().describe("The subject with variables filled in."),
  html: z.string(),
  text: z.string().describe("The plain-text part sent alongside the HTML."),
});
export type ApiTemplatePreview = z.infer<typeof ApiTemplatePreviewSchema>;

export const ApiTestSendResultSchema = z.object({
  sent: z.literal(true),
  to: z.string(),
  messageId: z.string().nullable().describe("The provider's id for the message, when it gives one."),
});

export const ApiValidationResultSchema = z.object({
  valid: z.literal(true),
  warnings: z.array(z.string()).describe("Not errors: things that are probably wrong but would save."),
});

/** Request bodies as the spec shows them: the same fields, the design named rather than spelled out. */
export const ApiCreateTemplateDocSchema = ApiCreateTemplateSchema.extend({ design: ApiDesignDocSchema });
export const ApiUpdateTemplateDocSchema = updateTemplateObject.extend({ design: ApiDesignDocSchema.optional() });
export const ApiPreviewTemplateDocSchema = previewObject.extend({ design: ApiDesignDocSchema.optional() });

/** A template as API v1 shows it; `design` only where asked (one template, not a list). */
export function toApiTemplateSummary(t: EmailTemplate): ApiTemplateSummary {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    preheader: t.preheader ?? null,
    locale: t.locale,
    status: t.status,
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
  };
}

export function toApiTemplate(t: EmailTemplate, design: unknown): ApiTemplate {
  return { ...toApiTemplateSummary(t), design: design as Record<string, unknown> };
}
