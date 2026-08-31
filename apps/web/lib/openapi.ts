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
          "The universal entry point for automations. Each event identifies a contact",
          "by email, updates it, and starts any workflow whose trigger node listens",
          "for that event type.",
          "",
          "| Event | Contact must exist | What it does |",
          "| --- | --- | --- |",
          "| `contact_added` | no — it is created | Creates the contact. |",
          "| `contact_updated` | **yes** | Updates `name`, `locale`, merges `metadata` into the contact. |",
          "| `tag_added` | **yes** | Merges `metadata.tags` into the contact's existing tags, de-duplicated. |",
          "| `order_created` | no — created if missing | Signals a purchase. |",
          "| `event_triggered` | no — created if missing | Generic custom event; use `metadata` to carry your own payload. |",
          "",
          "`metadata` is merged into the contact's `meta` object, so previously sent",
          "keys survive unless you overwrite them.",
        ].join("\n"),
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
                    enum: [
                      "contact_added",
                      "contact_updated",
                      "tag_added",
                      "order_created",
                      "event_triggered",
                    ],
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
                    description:
                      "Arbitrary attributes merged into the contact's `meta`. For `tag_added`, `metadata.tags` must be an array of strings.",
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
                    metadata: { tags: ["onboarded"] },
                  },
                },
                order_created: {
                  summary: "Purchase",
                  value: {
                    event: "order_created",
                    email: "customer@example.com",
                    metadata: { orderId: "A-1049", total: 42 },
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
              "`email` or `event` is missing, or the event name is not supported",
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
