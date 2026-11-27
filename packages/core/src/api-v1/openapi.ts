// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  ApiCreateTemplateDocSchema,
  ApiErrorSchema,
  ApiMeSchema,
  ApiPreviewTemplateDocSchema,
  ApiTemplatePreviewSchema,
  ApiTemplateSchema,
  ApiTemplateSummarySchema,
  ApiTestSendResultSchema,
  ApiTestSendSchema,
  ApiUpdateTemplateDocSchema,
  ApiValidationResultSchema,
  dataEnvelope,
} from "./schemas";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./pagination";

// Adds `.openapi()` to zod's prototype; the registry needs it on every schema it names.
extendZodWithOpenApi(z);

/** Every API v1 operation as `METHOD /path`; a test checks each one is in the spec and has a route. */
export const API_V1_OPERATIONS = [
  "GET /api/v1/me",
  "GET /api/v1/openapi.json",
  "GET /api/v1/templates",
  "POST /api/v1/templates",
  "GET /api/v1/templates/{id}",
  "PATCH /api/v1/templates/{id}",
  "POST /api/v1/templates/preview",
  "POST /api/v1/templates/{id}/test-send",
] as const;

function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "An API key with the manage permission: `Authorization: Bearer snl_...`.",
  });
  // Only the schema `register` returns becomes a $ref; the original would be inlined.
  const apiError = registry.register("ApiError", ApiErrorSchema);
  const me = registry.register("Me", ApiMeSchema);

  const errorResponse = (description: string) => ({
    description,
    content: { "application/json": { schema: apiError } },
  });
  /** Answers every authenticated operation can give, whatever it does. */
  const commonErrors = {
    401: errorResponse("Missing, malformed or unknown API key."),
    403: errorResponse("The key lacks the permission this operation needs (PERMISSION_REQUIRED)."),
    429: errorResponse("Too many requests; retry after the Retry-After header."),
    500: errorResponse("Something failed on Senlo's side; retry with backoff."),
  };

  registry.registerPath({
    method: "get",
    path: "/api/v1/me",
    operationId: "getMe",
    summary: "Who is calling",
    description: "The project, permissions and instance behind the API key. Use it to check a connection.",
    security: [{ [bearerAuth.name]: [] }],
    responses: {
      200: { description: "The caller.", content: { "application/json": { schema: dataEnvelope(me) } } },
      ...commonErrors,
    },
  });

  const json = <T extends z.ZodTypeAny>(schema: T) => ({ content: { "application/json": { schema } } });
  const security = [{ [bearerAuth.name]: [] }];
  const idParam = z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" } }) });
  const dryRunQuery = z.object({
    dryRun: z
      .enum(["true", "false"])
      .optional()
      .openapi({ description: "true: check the request and store nothing; answers { valid, warnings }." }),
  });
  const idempotencyHeader = z.object({
    "Idempotency-Key": z
      .string()
      .max(255)
      .optional()
      .openapi({ description: "Retrying with the same key and body within a day answers as the first time and creates nothing twice." }),
  });
  const template = registry.register("Template", ApiTemplateSchema);
  const templateSummary = registry.register("TemplateSummary", ApiTemplateSummarySchema);
  const validation = registry.register("ValidationResult", ApiValidationResultSchema);
  const invalid = { 400: errorResponse("The request is invalid; `issues` lists the fields, with their paths.") };
  const notFound = { 404: errorResponse("No such record in the key's project.") };

  registry.registerPath({
    method: "get",
    path: "/api/v1/templates",
    operationId: "listTemplates",
    summary: "List templates",
    description: "The project's templates, newest first, without their designs.",
    security,
    request: {
      query: z.object({
        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(MAX_PAGE_SIZE)
          .optional()
          .openapi({ description: `Page size, default ${DEFAULT_PAGE_SIZE}.` }),
        cursor: z.string().optional().openapi({ description: "nextCursor of the previous page." }),
      }),
    },
    responses: {
      200: {
        description: "A page of templates.",
        ...json(dataEnvelope(z.object({ items: z.array(templateSummary), nextCursor: z.string().nullable() }))),
      },
      ...invalid,
      ...commonErrors,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/templates",
    operationId: "createTemplate",
    summary: "Create a template",
    description:
      "From a design document (blocks, not HTML): the server renders the HTML, and the template opens in the visual editor. Its first version is kept.",
    security,
    request: { query: dryRunQuery, headers: idempotencyHeader, body: json(ApiCreateTemplateDocSchema) },
    responses: {
      201: { description: "The template.", ...json(dataEnvelope(template)) },
      200: { description: "dryRun: the request is valid.", ...json(dataEnvelope(validation)) },
      ...invalid,
      409: errorResponse("Idempotency-Key reused for another request, or the first one is still running."),
      ...commonErrors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/templates/{id}",
    operationId: "getTemplate",
    summary: "Get a template",
    description: "One template with its design document.",
    security,
    request: { params: idParam },
    responses: { 200: { description: "The template.", ...json(dataEnvelope(template)) }, ...notFound, ...commonErrors },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/v1/templates/{id}",
    operationId: "updateTemplate",
    summary: "Change a template",
    description:
      "Changes the fields sent; design replaces the whole document. Each change is kept as a version that can be restored in the editor.",
    security,
    request: { params: idParam, query: dryRunQuery, body: json(ApiUpdateTemplateDocSchema) },
    responses: {
      200: { description: "The template as changed, or (dryRun) { valid, warnings }.", ...json(dataEnvelope(template)) },
      ...invalid,
      ...notFound,
      ...commonErrors,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/templates/preview",
    operationId: "previewTemplate",
    summary: "Preview a template",
    description:
      "Renders a saved template (templateId) or an unsaved design, with data for its variables. Stores and sends nothing.",
    security,
    request: { body: json(ApiPreviewTemplateDocSchema) },
    responses: {
      200: { description: "The rendered email.", ...json(dataEnvelope(registry.register("TemplatePreview", ApiTemplatePreviewSchema))) },
      ...invalid,
      ...notFound,
      ...commonErrors,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/templates/{id}/test-send",
    operationId: "sendTestTemplate",
    summary: "Send a test",
    description:
      "Sends the saved template now, through the project's provider, to a member of the project's organization (self-hosted: the project owner). Any other address is refused with RECIPIENT_NOT_ALLOWED and the allowed ones in details.allowed.",
    security,
    request: { params: idParam, headers: idempotencyHeader, body: json(ApiTestSendSchema) },
    responses: {
      200: { description: "Accepted by the provider.", ...json(dataEnvelope(ApiTestSendResultSchema)) },
      ...invalid,
      ...notFound,
      502: errorResponse("The provider refused the email or did not answer (PROVIDER_ERROR)."),
      ...commonErrors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/openapi.json",
    operationId: "getOpenApiSpec",
    summary: "This specification",
    description: "Public: no API key needed.",
    responses: {
      200: { description: "OpenAPI 3.0 document.", content: { "application/json": { schema: z.object({}).passthrough() } } },
    },
  });

  return registry;
}

let cached: ReturnType<OpenApiGeneratorV3["generateDocument"]> | undefined;

/** The API v1 OpenAPI document, generated once from the zod schemas. */
export function apiV1OpenApiDocument() {
  cached ??= new OpenApiGeneratorV3(buildRegistry().definitions).generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Senlo API v1",
      version: "1.0.0",
      description: [
        "Manage templates, triggers and automations of one project.",
        "",
        "Every response is JSON. Success: `{ \"data\": ... }`. Failure: `{ \"error\": { code, message, hint, issues?, requestId } }`.",
        "Every response carries `X-Request-Id`.",
      ].join("\n"),
    },
    servers: [{ url: "/" }],
  });
  return cached;
}
