// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { EVENT_NAME_PATTERN, MAX_IDEMPOTENCY_KEY_LENGTH, SYSTEM_EVENT_TYPES } from "./workflow-events";

/**
 * The public API, as the docs page renders it. Hand-written for now; the
 * request bodies mirror `TriggeredEmailRequestSchema` and
 * `EventRequestSchema`, which are what the routes actually enforce.
 */
export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Senlo Public API",
    version: "1.0.0",
    description: [
      "API for triggering emails and feeding contact events into automations.",
      "",
      "## Authentication",
      "",
      "Every endpoint below requires an API key, sent as a bearer token:",
      "",
      "```",
      "Authorization: Bearer snl_your_api_key",
      "```",
      "",
      "Keys are created per project in your workspace under **Settings → Keys**.",
      "A key is scoped to the project it was created in — the project is resolved",
      "from the key itself, which is why no project ID appears in any payload.",
    ].join("\n"),
  },
  servers: [
    {
      url: "/api",
      description: "Default API Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
    schemas: {
      Contact: {
        type: "object",
        properties: {
          id: { type: "number" },
          projectId: { type: "number" },
          email: { type: "string", format: "email" },
          name: { type: "string", nullable: true },
          locale: { type: "string", nullable: true },
          meta: {
            type: "object",
            nullable: true,
            description:
              "Arbitrary contact attributes, merged on every update.",
          },
          unsubscribed: { type: "boolean" },
          unsubscribedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    "/triggered": {
      post: {
        summary: "Trigger an email",
        description: [
          "Queues a single transactional email from a triggered campaign.",
          "The campaign must belong to the project the API key is scoped to.",
          "",
          "The response returns as soon as the job is queued — it does not mean",
          "the provider has accepted the message yet.",
        ].join("\n"),
        tags: ["Emails"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["to"],
                properties: {
                  id: {
                    oneOf: [{ type: "number" }, { type: "string" }],
                    description:
                      "Trigger ID. Either `id` or `campaignId` is required; `id` wins if both are sent.",
                  },
                  campaignId: {
                    oneOf: [{ type: "number" }, { type: "string" }],
                    description:
                      "Alias for `id`, kept for backwards compatibility.",
                  },
                  to: { type: "string", format: "email" },
                  data: {
                    type: "object",
                    description:
                      'Merge tag values available to the template, e.g. `{ "order": { "total": 42 } }`.',
                  },
                  locale: {
                    type: "string",
                    description:
                      "Target locale (e.g. `en`, `ru`). Selects the localized version of the template.",
                  },
                  subject: {
                    type: "string",
                    description:
                      "Overrides the campaign's subject line for this send. Merge tags are resolved in it.",
                  },
                },
              },
              examples: {
                default: {
                  summary: "Order confirmation",
                  value: {
                    id: 12,
                    to: "customer@example.com",
                    locale: "en",
                    data: { order: { number: "A-1049", total: "42.00" } },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Email queued successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          400: {
            description:
              "`to` is missing, neither `id` nor `campaignId` was sent, or the send failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: {
            description: "Missing or invalid API key",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Trigger not found in this project",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/events": {
      post: {
        summary: "Send a contact event",
        description: [
          "The universal entry point for automations. Each event names a contact by email,",
          "is stored in the contact's event history and starts every active workflow whose",
          "trigger listens for that event name.",
          "",
          "Three names are system events with a side effect on the contact; any other name",
          "(`trial_started`, `invoice.paid`) is a custom event.",
          "",
          "| Event | Contact must exist | What it does |",
          "| --- | --- | --- |",
          "| `contact_added` | no — it is created | Creates the contact (or updates a known address). |",
          "| `contact_updated` | **yes** | Updates `name`, `locale`, merges `metadata` into the contact. |",
          "| `tag_added` | **yes** | Adds `payload.tags` to the contact's tags, de-duplicated. |",
          "| any other name | no — created if missing | A custom event. |",
          "",
          "`metadata` is contact attributes: merged into the contact's `meta`, so earlier keys",
          "survive unless you overwrite them. `payload` is the event's own data: emails read it",
          "as `{{event.*}}`; it is not stored on the contact.",
          "",
          "Send an `Idempotency-Key` header (or `idempotencyKey` in the body) to make a retry",
          "safe: a key the project has already used returns `200` with the contact and",
          "starts nothing.",
        ].join("\n"),
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string", maxLength: MAX_IDEMPOTENCY_KEY_LENGTH },
            description: "Unique per event within the project. Wins over `idempotencyKey` in the body.",
          },
        ],
        tags: ["Events"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["event", "email"],
                properties: {
                  event: {
                    type: "string",
                    pattern: EVENT_NAME_PATTERN.source,
                    description: `A system event (${SYSTEM_EVENT_TYPES.map((e) => `\`${e}\``).join(", ")}) or any custom name: lowercase letters, digits and \`_ . : -\`, 64 characters at most.`,
                  },
                  email: { type: "string", format: "email" },
                  name: { type: "string" },
                  locale: {
                    type: "string",
                    description:
                      "Contact locale (e.g. `en`, `ru`). Automations use it to pick the language of the emails they send.",
                  },
                  metadata: {
                    type: "object",
                    description: "Contact attributes, merged into the contact's `meta`. Not part of the event.",
                  },
                  payload: {
                    type: "object",
                    description:
                      "The event's data, at most 32 KB of JSON: `{{event.*}}` in emails. For `tag_added`, `payload.tags` is required: a non-empty array of strings.",
                  },
                  idempotencyKey: {
                    type: "string",
                    maxLength: MAX_IDEMPOTENCY_KEY_LENGTH,
                    description: "Same as the `Idempotency-Key` header.",
                  },
                },
              },
              examples: {
                contact_added: {
                  summary: "New signup",
                  value: {
                    event: "contact_added",
                    email: "user@example.com",
                    name: "Jean-Pierre",
                    locale: "fr",
                    metadata: { plan: "premium", source: "saas_app" },
                  },
                },
                tag_added: {
                  summary: "Tag an existing contact",
                  value: {
                    event: "tag_added",
                    email: "user@example.com",
                    payload: { tags: ["onboarded"] },
                  },
                },
                custom: {
                  summary: "Custom event with a payload",
                  value: {
                    event: "invoice_failed",
                    email: "customer@example.com",
                    payload: { invoiceId: "in_1049", amount: 42, currency: "EUR" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Event processed and any matching automations started",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/Contact" },
                  },
                },
              },
            },
          },
          400: {
            description:
              "`email` or `event` is missing, the event name is malformed, the payload is over 32 KB, or `tag_added` has no `payload.tags`",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          401: {
            description: "Missing or invalid API key",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          500: {
            description:
              "Processing failed — for `contact_updated` and `tag_added` this is also what a missing contact returns (`Contact not found`)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
};
