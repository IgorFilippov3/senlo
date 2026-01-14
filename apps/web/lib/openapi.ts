export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Senlo Public API",
    version: "1.0.0",
    description: "API for managing email campaigns, audience lists, and contacts.",
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
      RecipientList: {
        type: "object",
        properties: {
          id: { type: "number" },
          projectId: { type: "number" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Contact: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          name: { type: "string", nullable: true },
          meta: { type: "object", nullable: true },
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
        summary: "Trigger a transactional email",
        tags: ["Campaigns"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["campaignId", "to"],
                properties: {
                  campaignId: { type: "number" },
                  to: { type: "string", format: "email" },
                  data: { type: "object", description: "Merge tags data" },
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
        },
      },
    },
    "/v1/audience/lists": {
      get: {
        summary: "List all audience lists",
        tags: ["Audience"],
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RecipientList" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new audience list",
        tags: ["Audience"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/RecipientList" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/audience/lists/{id}": {
      delete: {
        summary: "Delete an audience list",
        tags: ["Audience"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "number" },
          },
        ],
        responses: {
          200: {
            description: "Deleted",
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
        },
      },
    },
    "/v1/audience/lists/{id}/contacts": {
      post: {
        summary: "Add contacts to a list",
        tags: ["Audience"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "number" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contacts"],
                properties: {
                  contacts: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Contact" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        count: { type: "number" },
                        contacts: { type: "array", items: { type: "object" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: "Remove contacts from a list",
        tags: ["Audience"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "number" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["emails"],
                properties: {
                  emails: {
                    type: "array",
                    items: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        removedCount: { type: "number" },
                        missingCount: { type: "number" },
                        missingEmails: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          404: {
            description: "No contacts found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    error: { type: "string" },
                    missingEmails: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
