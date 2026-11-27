// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenApiGeneratorV31, OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { BLOCK_REGISTRY, CONTENT_BLOCK_TYPES } from "../blocks/registry";
import { emailDesignDocumentSchema, emailDesignVersion, type EmailDesignDocument } from "../emailDesign";
import { DESIGN_DOCUMENT_FORMAT } from "../services/ai/aiDesignService";
import { WorkflowExportSchema } from "../workflow-export";
import { WORKFLOW_TEMPLATES } from "../workflow-templates";

extendZodWithOpenApi(z);

/**
 * `GET /api/v1/guide`: everything a coding agent needs to write Senlo
 * content without guessing: the rules in prose, JSON Schemas generated
 * from the schemas that check its requests, every block type with a
 * starting value, every automation step type, and examples that pass the
 * same checks (a test makes sure of that).
 */

/** Bumped when the guide changes in a way a client may want to notice. */
export const API_GUIDE_VERSION = 1;

export const AUTOMATION_STEP_TYPES: Array<{ type: string; summary: string; data: string }> = [
  {
    type: "trigger",
    summary: "Starts a run when the contact does an event. Exactly one per automation, with no incoming edge.",
    data: '{ event: "signed_up", filters?: ConditionGroup } — event is lowercase letters, digits and _ . : - ; contact_added fires when a contact is created.',
  },
  {
    type: "action",
    summary: "Sends an email: the template of a trigger.",
    data: '{ triggerId: "17", label?: "Welcome" } — in an export, { emailRef: "<trigger name>" } instead of triggerId.',
  },
  {
    type: "delay",
    summary: "Waits for a time, or until a date.",
    data: '{ duration: 3, unit: "minutes" | "hours" | "days" }, or { mode: "until", until: { source: "event" | "contact", path: "trial_ends_at", offset?: { duration, unit, direction: "before" | "after" } } }',
  },
  {
    type: "condition",
    summary: "Branches on rules (or on your API's answer). Two outgoing edges: sourceHandle \"yes\" and \"no\".",
    data: '{ mode: "rules", conditions: ConditionGroup } or { mode: "api", url: "https://..." }',
  },
  {
    type: "wait_event",
    summary: "Waits for the contact to do an event, at most the timeout. Edge \"yes\": it happened; \"no\": timed out.",
    data: '{ event: "project_created", timeout: { duration: 3, unit: "days" }, filters?: ConditionGroup }',
  },
  {
    type: "update_contact",
    summary: "Writes attributes on the contact; tags are added to the existing ones.",
    data: '{ updates: { plan: "pro", tags: ["trial"] } }',
  },
  {
    type: "http_request",
    summary: "Calls a URL; its JSON answer is available to later steps as {{steps.<nodeId>.body.<field>}}.",
    data: '{ method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: "https://...", headers?: [{ name, value }], body?: "JSON with {{merge tags}}", timeoutSeconds?: 1-30 }',
  },
  {
    type: "exit",
    summary: "Ends the run. Optional: a branch without a next step ends too. Must have no outgoing edge.",
    data: "{}",
  },
];

/**
 * A complete transactional email: what a "password reset" request should
 * produce. Every field is real; the test checks it against the schema.
 */
export const EXAMPLE_PASSWORD_RESET_DESIGN: EmailDesignDocument = {
  version: emailDesignVersion,
  settings: { backgroundColor: "#f4f4f5", contentWidth: 600, fontFamily: "Arial, Helvetica, sans-serif", textColor: "#111827" },
  rows: [
    {
      id: "row-header",
      type: "row",
      settings: { backgroundColor: "#ffffff", padding: { top: 24, right: 24, bottom: 8, left: 24 } },
      columns: [
        {
          id: "col-header",
          width: 100,
          blocks: [{ id: "b-brand", type: "heading", data: { text: "{{project.name}}", level: 3, align: "left", color: "#4f46e5" } }],
        },
      ],
    },
    {
      id: "row-body",
      type: "row",
      settings: { backgroundColor: "#ffffff", padding: { top: 8, right: 24, bottom: 24, left: 24 } },
      columns: [
        {
          id: "col-body",
          width: 100,
          blocks: [
            { id: "b-title", type: "heading", data: { text: "Reset your password", level: 1 } },
            {
              id: "b-intro",
              type: "paragraph",
              data: { text: "Hi {{userName}}, we got a request to reset the password for your account.", fontSize: 16, lineHeight: 1.5 },
            },
            {
              id: "b-cta",
              type: "button",
              data: { text: "Choose a new password", href: "{{resetLink}}", backgroundColor: "#4f46e5", color: "#ffffff", borderRadius: 6 },
            },
            { id: "b-gap", type: "spacer", data: { height: 16 } },
            {
              id: "b-note",
              type: "paragraph",
              data: { text: "The link works for 60 minutes. If you did not ask for this, ignore this email: your password stays the same.", fontSize: 14, color: "#6b7280" },
            },
          ],
        },
      ],
    },
    {
      id: "row-footer",
      type: "row",
      settings: { padding: { top: 16, right: 24, bottom: 24, left: 24 } },
      columns: [
        {
          id: "col-footer",
          width: 100,
          blocks: [
            {
              id: "b-footer",
              type: "paragraph",
              data: { text: "You get this email because a password reset was requested for your {{project.name}} account.", fontSize: 12, color: "#9ca3af", align: "center" },
            },
          ],
        },
      ],
    },
  ],
} as unknown as EmailDesignDocument;

const GUIDE_TEXT = `# Senlo for coding agents

Senlo sends transactional email through the user's own provider. You create the content through API v1 (or the Senlo MCP server, which wraps it); the user's code sends it with one call. Everything you make opens in Senlo's visual editor, where anyone on the team can change it later, so build it the way the editor builds it.

## The usual order

1. **Template**: \`POST /api/v1/templates\` with a design document (below). Check it first with \`?dryRun=true\`, and look at it with \`POST /api/v1/templates/preview\` and sample \`data\`.
2. **Trigger**: \`POST /api/v1/triggers\` with the template's id and \`variablesSchema\`: one sample value per variable the template uses. The trigger's \`id\` is what the user's code sends.
3. **Send from code**: \`POST /api/triggered\` with \`{ "id": <trigger id>, "to": "<recipient>", "data": { <variables> } }\` and a key with the \`send\` permission (not yours).
4. **Test**: \`POST /api/v1/templates/{id}/test-send\` to a member of the organization (GET /api/v1/me shows the project; a refused address answers with the allowed ones).
5. **Automation** (optional): \`POST /api/v1/automations\` with an export, test it with \`POST /api/v1/automations/{id}/test-runs\`, read \`GET /api/v1/automation-runs/{runId}\` until it ends, then \`POST /api/v1/automations/{id}/publish\`.

Use an \`Idempotency-Key\` on every create, so a retry never makes a second copy. Never delete: there is no delete in the API; the user removes what is not needed in the UI.

## Errors

Every error has \`code\`, \`message\`, \`hint\` and, for invalid input, \`issues\` with the full path of each field (\`design.rows[1].columns[0].blocks[2].data.href\`). Fix exactly those fields and send again. \`UNKNOWN_FIELD\` is a typo at the top of the body. \`NOT_PUBLISHABLE\` lists in \`details.reasons\` what keeps an automation from running.

## The design document

A template is not HTML. It is a design document of rows, columns and blocks; Senlo renders the HTML. Version: ${emailDesignVersion}.

{
  "version": ${emailDesignVersion},
  "settings": { "backgroundColor": "#f4f4f5", "contentWidth": 600, "fontFamily": "Arial, Helvetica, sans-serif", "textColor": "#111827" },
  "rows": [ Row, ... ]
}

${DESIGN_DOCUMENT_FORMAT}

\`schemas.emailDesignDocument\` is the exact JSON Schema; \`blocks\` gives every block type with a valid starting \`data\`; \`examples.template\` is a complete email.

## Variables and merge tags

- \`{{userName}}\`: a variable of the template's trigger. Use plain names (letters, digits, underscores) and list each one in the trigger's \`variablesSchema\` with a sample value. The user's code passes the real values in \`data\`. The same name in an automation email reads the contact's attribute.
- \`{{contact.email}}\`, \`{{contact.name}}\`: the recipient.
- \`{{project.name}}\`: the workspace's name.
- \`{{unsubscribeUrl}}\`: the unsubscribe link, for marketing (lifecycle) mail.
- In automation emails also \`{{event.<field>}}\` (the payload of the event that started the run) and \`{{steps.<nodeId>.<path>}}\` (the output of an earlier step, such as an HTTP request's body).
- A row with \`loop\` repeats per array element; inside it, \`{{item.<field>}}\` with the loop's alias.

A tag with no value renders as written, so check the preview with realistic \`data\`.

## Design rules

- Real content for the request: concrete headings, copy and button labels, no lorem ipsum. What the recipient must do goes first.
- One column of 600px for most transactional email; columns only for side-by-side content.
- Rows with their own background and padding separate header, body and footer. Spacers for vertical rhythm, not empty paragraphs.
- One accent color for buttons and headings. Body text dark on light, fontSize 14-16, lineHeight 1.4-1.6.
- Images need an absolute https \`src\`. Do not invent image URLs; leave the image out instead.
- End with a short footer: who sends it and why the recipient gets it.
- Paragraph text is plain text: no HTML tags. A link is a \`button\`, or \`href\` on a heading or paragraph.

## Turning an existing email into a template

When the user pastes an HTML email to bring into Senlo, do not send the HTML: rebuild it as a design document.

1. Read its structure top to bottom: header, sections, footer. Each band of the email is a row; side-by-side parts are columns.
2. Map each piece to a block: titles to \`heading\`, text to \`paragraph\`, buttons and call-to-action links to \`button\`, pictures to \`image\` (keep their https URLs as they are), rules to \`divider\`, gaps to \`spacer\`, bullet lists to \`list\`, label-value lines (an order summary) to \`product-line\`, data grids to \`table\`.
3. Carry over colors, font sizes, alignment and padding as block and row settings.
4. Replace personal values (a name, an order number, a link) with \`{{variables}}\`, and list them on the trigger.
5. Validate with \`?dryRun=true\`, then compare \`POST /api/v1/templates/preview\` with the original and adjust.

## Triggers

\`{ name, templateId, fromName?, fromEmail?, variablesSchema?, localeTemplates? }\`. \`variablesSchema\` is a JSON object of sample values (\`{ "userName": "Ada", "resetLink": "https://..." }\`), not a type schema: the names become the editor's merge tags and the values fill its preview. \`localeTemplates\` maps a contact locale to another template of the project.

## Automations

An automation is exchanged as an export: \`{ "format": "senlo.workflow", "version": 1, "name", "description"?, "settings", "nodes": [{ "id", "type", "data" }], "edges": [{ "id", "source", "target", "sourceHandle" }] }\`.

- Node ids are yours: short strings unique in the export. On create Senlo gives them new ids; on PUT it keeps the ones the automation already has. Errors name your ids.
- Email steps (\`action\`) name a trigger with \`data.emailRef\` (its name), or pass \`emails: { "<emailRef>": <trigger id> }\` next to \`workflow\`. Every email must resolve to a trigger of the project.
- \`condition\` and \`wait_event\` have two outgoing edges, with \`sourceHandle\` \`"yes"\` and \`"no"\`. Every other step has at most one, with \`sourceHandle\` null.
- \`settings\`: \`kind\` (\`"transactional"\`, default, or \`"lifecycle"\` for marketing mail, which respects unsubscribes), \`goal: { event }\` (a run ends when the contact does it), \`entry: { mode: "once" | "after_exit" | "restart" }\`.
- A ConditionGroup is \`{ "op": "and" | "or", "rules": [Rule or ConditionGroup, ...] }\`. A Rule is one of: \`{ "source": "contact" | "event", "path", "operator", "value"? }\`, \`{ "source": "step", "nodeId", "path", "operator", "value"? }\`, \`{ "source": "history", "event", "did": true | false, "withinDays"? }\`, \`{ "source": "email", "nodeId", "state": "opened" | "not_opened" | "clicked" | "not_clicked" }\`. Operators: eq, neq, contains, not_contains, gt, gte, lt, lte, exists, not_exists, in.

\`stepTypes\` lists every step with its data; \`examples.automations\` are the gallery's automations, each a valid export.

A draft does nothing until published. Test it first: a test run follows the saved draft for one member of the organization, skips delays, and sends real email.
`;

let cached: ReturnType<typeof build> | undefined;

function jsonSchemas() {
  const registry = new OpenAPIRegistry();
  registry.register("EmailDesignDocument", emailDesignDocumentSchema);
  registry.register("AutomationExport", WorkflowExportSchema);
  const components = new OpenApiGeneratorV31(registry.definitions).generateComponents().components?.schemas ?? {};
  return { emailDesignDocument: components.EmailDesignDocument, automationExport: components.AutomationExport };
}

function build() {
  return {
    version: API_GUIDE_VERSION,
    designVersion: emailDesignVersion,
    guide: GUIDE_TEXT,
    schemas: jsonSchemas(),
    blocks: CONTENT_BLOCK_TYPES.map((type) => ({
      type,
      label: BLOCK_REGISTRY[type].label,
      example: { id: `${type}-1`, type, data: BLOCK_REGISTRY[type].createDefaults() },
    })),
    stepTypes: AUTOMATION_STEP_TYPES,
    examples: {
      template: {
        name: "Password reset",
        subject: "Reset your password",
        preheader: "The link works for 60 minutes.",
        design: EXAMPLE_PASSWORD_RESET_DESIGN,
      },
      trigger: {
        name: "Password reset",
        templateId: "<the template's id>",
        variablesSchema: { userName: "Ada", resetLink: "https://example.com/reset/abc123" },
      },
      automations: WORKFLOW_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        summary: t.summary,
        events: t.events,
        workflow: t.workflow,
      })),
    },
  };
}

/** The guide, built once. */
export function apiV1Guide() {
  cached ??= build();
  return cached;
}

export type ApiGuide = ReturnType<typeof apiV1Guide>;
