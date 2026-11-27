// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse, type NextRequest } from "next/server";
import {
  PermissionRequiredError,
  clientLabel,
  logError,
  principalFromApiKey,
  type ApiPermission,
  type ApiPrincipal,
} from "@senlo/core";
import { apiV1OpenApiDocument } from "@senlo/core/server";
import {
  apiV1Guide,
  parsePageQuery,
  toApiAutomation,
  toApiAutomationRun,
  toApiTrigger,
  toApiTemplate,
  toApiTemplateSummary,
  type ApiMe,
} from "@senlo/core/server";
import { validateApiKey } from "./api-auth";
import { REQUEST_ID_HEADER, newRequestId } from "./api-v1";
import { createV1Route, isDryRun, pathId } from "./api-v1-route";
import { errorResponse } from "./errors";
import type { SenloHost } from "./host";
import { confirmLeavingResponse, pixelResponse, requestMetadata } from "./tracking";
import { handleProviderWebhook } from "./webhooks";

/** What Next passes as the second argument to a handler of a dynamic route. */
interface RouteContext<P> {
  params: Promise<P>;
}

type Handler = (request: NextRequest) => Promise<Response>;
type ParamHandler<P> = (request: NextRequest, context: RouteContext<P>) => Promise<Response>;

/**
 * Every API route of a Senlo host, with the behaviour of self-hosted. The
 * host builds them once and re-exports each from its route file:
 *
 * ```ts
 * // app/api/events/route.ts
 * export const { POST } = routes.events;
 * ```
 *
 * Paths are the host's (its `app/` tree), but mail already sent points at
 * `/api/t/*`, `/api/track/*` and `/api/unsubscribe/*`, and providers at
 * `/api/webhooks/*`: those must stay where self-hosted has them.
 */
export function createSenloRoutes(host: SenloHost) {
  const services = () => host.getServices();

  /**
   * Rate limit, API key and its permission, then the body; shared by the
   * public API routes outside v1. Their errors keep the old shape.
   */
  const apiRoute =
    (
      permission: ApiPermission,
      label: string,
      success: string,
      run: (
        projectId: number,
        body: unknown,
        req: NextRequest,
        principal: ApiPrincipal,
      ) => Promise<{ response: Response; log: Record<string, unknown> }>,
    ): Handler =>
    async (req) => {
      const limited = await host.rateLimit.limitRequest(req, "api");
      if (limited) return limited;

      const auth = await validateApiKey(host, req);
      if (!auth.success) return auth.response;
      const projectId = auth.apiKey.projectId;
      if (!auth.apiKey.permissions.includes(permission)) {
        const refused = new PermissionRequiredError(permission);
        logError(host.logger, `${label} API error`, refused, { projectId });
        return errorResponse(refused);
      }

      try {
        const body = await req.json().catch(() => ({}));
        const principal = principalFromApiKey(auth.apiKey, clientLabel(req.headers.get("Senlo-Client")));
        const { response, log } = await run(projectId, body, req, principal);
        host.logger.info(success, { ...log, projectId });
        return response;
      } catch (error) {
        logError(host.logger, `${label} API error`, error, { projectId });
        return errorResponse(error);
      }
    };

  /** Like `apiRoute`, for a route with an `[id]` segment: a malformed id is a 404. */
  const apiIdRoute =
    (
      permission: ApiPermission,
      label: string,
      success: string,
      run: (
        projectId: number,
        id: number,
        body: unknown,
        principal: ApiPrincipal,
      ) => Promise<{ response: Response; log: Record<string, unknown> }>,
    ): ParamHandler<{ id: string }> =>
    async (req, { params }) => {
      const { id: raw } = await params;
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
      }
      return apiRoute(permission, label, success, (projectId, body, _req, principal) =>
        run(projectId, id, body, principal),
      )(req);
    };

  /**
   * `/api/workflows*` moved to `/api/v1/automations*`: same behaviour and
   * answers as before, with `Deprecation` and the successor's address.
   */
  const deprecated = (response: Response, successor: string): Response => {
    response.headers.set("Deprecation", "true");
    response.headers.set("Link", `<${successor}>; rel="successor-version"`);
    return response;
  };

  const v1Route = createV1Route(host);

  /** An automation as API v1 shows one: the record and its export. */
  const automationWithExport = async (principal: ApiPrincipal, id: number) => {
    const workflow = await services().workflow.requireWorkflow(principal, id, "read");
    return { ...toApiAutomation(workflow), workflow: await services().workflow.exportWorkflow(principal, id) };
  };

  /** Signed-in user, rate limited per user. */
  const userRoute =
    (bucket: "upload" | "ai", run: (userId: string, req: NextRequest) => Promise<Response>): Handler =>
    async (req) => {
      const userId = await host.currentUserId();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const limited = await host.rateLimit.limitRequest(req, bucket, `user:${userId}`);
      if (limited) return limited;
      return run(userId, req);
    };

  return {
    /** `GET /api/v1/me`: the project, permissions and instance behind the key. */
    v1Me: {
      GET: v1Route("getMe", { permission: "manage" }, async ({ principal }) => {
        const me: ApiMe = {
          ...(await services().auth.describePrincipal(principal)),
          instance: { edition: host.edition ?? "self-hosted", apiVersion: "v1" },
        };
        return { data: me };
      }),
    },

    /** `/api/v1/templates`: the key's project's templates, and creating one from a design. */
    v1Templates: {
      GET: v1Route("listTemplates", { permission: "manage" }, async ({ principal, req }) => {
        const page = await services().template.listPage(
          principal,
          principal.projectId,
          parsePageQuery(new URL(req.url).searchParams),
        );
        return { data: { items: page.items.map(toApiTemplateSummary), nextCursor: page.nextCursor } };
      }),
      POST: v1Route("createTemplate", { permission: "manage", idempotent: true }, async ({ principal, req, body }) => {
        const dryRun = isDryRun(req);
        const created = await services().template.createFromApi(principal, principal.projectId, body, { dryRun });
        if (!created) return { data: { valid: true, warnings: [] } };
        return { data: toApiTemplate(created, created.designJson), status: 201 };
      }),
    },

    /** `/api/v1/templates/[id]`: one template with its design, and changing it. */
    v1Template: {
      GET: v1Route<{ id: string }>("getTemplate", { permission: "manage" }, async ({ principal, params }) => {
        const { template, design } = await services().template.getWithDesign(principal, pathId(params.id, "Template"));
        return { data: toApiTemplate(template, design) };
      }),
      PATCH: v1Route<{ id: string }>("updateTemplate", { permission: "manage" }, async ({ principal, params, req, body }) => {
        const id = pathId(params.id, "Template");
        const updated = await services().template.updateFromApi(principal, id, body, { dryRun: isDryRun(req) });
        if (!updated) return { data: { valid: true, warnings: [] } };
        return { data: toApiTemplate(updated, updated.designJson) };
      }),
    },

    /** `POST /api/v1/templates/preview`: the rendered email, stored and sent nowhere. */
    v1TemplatePreview: {
      POST: v1Route("previewTemplate", { permission: "manage" }, async ({ principal, body }) => ({
        data: await services().template.previewFromApi(principal, principal.projectId, body),
      })),
    },

    /** `POST /api/v1/templates/[id]/test-send`: a test to a member of the organization. */
    v1TemplateTestSend: {
      POST: v1Route<{ id: string }>(
        "sendTestTemplate",
        { permission: "manage", idempotent: true },
        async ({ principal, params, body }) => {
          const result = await services().template.sendTestFromApi(principal, pathId(params.id, "Template"), body);
          return { data: { sent: true, ...result } };
        },
      ),
    },

    /** `/api/v1/triggers`: the key's project's triggers, and creating one for a template. */
    v1Triggers: {
      GET: v1Route("listTriggers", { permission: "manage" }, async ({ principal, req }) => {
        const page = await services().campaign.listPage(
          principal,
          principal.projectId,
          parsePageQuery(new URL(req.url).searchParams),
        );
        return { data: { items: page.items.map(toApiTrigger), nextCursor: page.nextCursor } };
      }),
      POST: v1Route("createTrigger", { permission: "manage", idempotent: true }, async ({ principal, req, body }) => {
        const created = await services().campaign.createFromApi(principal, principal.projectId, body, {
          dryRun: isDryRun(req),
        });
        if (!created) return { data: { valid: true, warnings: [] } };
        return { data: toApiTrigger(created), status: 201 };
      }),
    },

    /** `/api/v1/triggers/[id]`: one trigger, and changing it. */
    v1Trigger: {
      GET: v1Route<{ id: string }>("getTrigger", { permission: "manage" }, async ({ principal, params }) => ({
        data: toApiTrigger(await services().campaign.getTrigger(principal, pathId(params.id, "Trigger"))),
      })),
      PATCH: v1Route<{ id: string }>("updateTrigger", { permission: "manage" }, async ({ principal, params, req, body }) => {
        const updated = await services().campaign.updateFromApi(principal, pathId(params.id, "Trigger"), body, {
          dryRun: isDryRun(req),
        });
        if (!updated) return { data: { valid: true, warnings: [] } };
        return { data: toApiTrigger(updated) };
      }),
    },

    /** `/api/v1/automations`: the key's project's automations, and creating a draft from an export. */
    v1Automations: {
      GET: v1Route("listAutomations", { permission: "manage" }, async ({ principal, req }) => {
        const page = await services().workflow.listPage(
          principal,
          principal.projectId,
          parsePageQuery(new URL(req.url).searchParams),
        );
        return { data: { items: page.items.map(toApiAutomation), nextCursor: page.nextCursor } };
      }),
      POST: v1Route("createAutomation", { permission: "manage", idempotent: true }, async ({ principal, req, body }) => {
        const created = await services().workflow.createFromApi(principal, principal.projectId, body, {
          dryRun: isDryRun(req),
        });
        if (!created) return { data: { valid: true, warnings: [] } };
        return { data: await automationWithExport(principal, created.id), status: 201 };
      }),
    },

    /** `/api/v1/automations/[id]`: one automation with its export, and replacing its draft. */
    v1Automation: {
      GET: v1Route<{ id: string }>("getAutomation", { permission: "manage" }, async ({ principal, params }) => ({
        data: await automationWithExport(principal, pathId(params.id, "Automation")),
      })),
      PUT: v1Route<{ id: string }>("replaceAutomation", { permission: "manage" }, async ({ principal, params, req, body }) => {
        const id = pathId(params.id, "Automation");
        const replaced = await services().workflow.replaceFromApi(principal, id, body, { dryRun: isDryRun(req) });
        if (!replaced) return { data: { valid: true, warnings: [] } };
        return { data: await automationWithExport(principal, id) };
      }),
    },

    /** `POST /api/v1/automations/[id]/publish`: go live, with the builder's checks. */
    v1AutomationPublish: {
      POST: v1Route<{ id: string }>("publishAutomation", { permission: "manage" }, async ({ principal, params }) => ({
        data: toApiAutomation(await services().workflow.publish(principal, pathId(params.id, "Automation"))),
      })),
    },

    /** `POST /api/v1/automations/[id]/pause`: no new runs; runs in flight finish. */
    v1AutomationPause: {
      POST: v1Route<{ id: string }>("pauseAutomation", { permission: "manage" }, async ({ principal, params }) => ({
        data: toApiAutomation(await services().workflow.pause(principal, pathId(params.id, "Automation"))),
      })),
    },

    /** `POST /api/v1/automations/[id]/test-runs`: a test run of the draft for a member of the organization. */
    v1AutomationTestRuns: {
      POST: v1Route<{ id: string }>(
        "testAutomation",
        { permission: "manage", idempotent: true },
        async ({ principal, params, body }) => ({
          data: await services().automationRuns.startTestRun(principal, pathId(params.id, "Automation"), body ?? {}),
          status: 201,
        }),
      ),
    },

    /** `GET /api/v1/automation-runs/[id]`: a run and its steps, to see how a test went. */
    v1AutomationRun: {
      GET: v1Route<{ id: string }>("getAutomationRun", { permission: "manage" }, async ({ principal, params }) => ({
        data: toApiAutomationRun(await services().automationRuns.getRun(principal, pathId(params.id, "Run"))),
      })),
    },

    /** `GET /api/v1/guide`: the format guide for coding agents. Public, built once. */
    v1Guide: {
      GET: (async () =>
        NextResponse.json(
          { data: apiV1Guide() },
          { headers: { "Cache-Control": "public, max-age=300", [REQUEST_ID_HEADER]: newRequestId() } },
        )) satisfies Handler,
    },

    /** `GET /api/v1/openapi.json`: the v1 spec, generated from the zod schemas. Public. */
    v1OpenApi: {
      GET: (async () =>
        NextResponse.json(apiV1OpenApiDocument(), {
          headers: { "Cache-Control": "public, max-age=300", [REQUEST_ID_HEADER]: newRequestId() },
        })) satisfies Handler,
    },

    /** `POST /api/events`: the universal trigger. */
    events: {
      POST: apiRoute("send", "Event", "Event processed via API", async (projectId, body, req) => {
        const { event, contact, duplicate } = await services().events.ingest(projectId, body, {
          idempotencyKey: req.headers.get("idempotency-key"),
        });
        // A repeated idempotency key answers like the first request did.
        return {
          response: NextResponse.json({ success: true, data: contact }),
          log: duplicate ? { event: event.event, duplicate } : { event: event.event },
        };
      }),
    },

    /** `POST /api/automations/cancel`: end a contact's runs in progress. */
    automationsCancel: {
      POST: apiRoute("send", "Cancel automations", "Automation runs cancelled via API", async (projectId, body) => {
        const result = await services().automation.cancelFromRequest(projectId, body);
        return {
          response: NextResponse.json({ success: true, data: result }),
          log: { cancelled: result.cancelled },
        };
      }),
    },

    /** `POST /api/workflows`: create a draft automation from an export (D9). */
    workflows: {
      POST: apiRoute("manage", "Workflow import", "Workflow created via API", async (projectId, body, _req, principal) => {
        const workflow = (await services().workflow.createFromApi(principal, projectId, body))!;
        return {
          response: deprecated(
            NextResponse.json({ success: true, data: { id: workflow.id, status: workflow.status } }, { status: 201 }),
            "/api/v1/automations",
          ),
          log: { workflowId: workflow.id },
        };
      }),
    },

    /** `GET /api/workflows/[id]`: the automation as an export. */
    workflow: {
      GET: apiIdRoute("manage", "Workflow export", "Workflow exported via API", async (_projectId, id, _body, principal) => {
        const data = await services().workflow.exportWorkflow(principal, id);
        return {
          response: deprecated(NextResponse.json({ success: true, data }), `/api/v1/automations/${id}`),
          log: { workflowId: id },
        };
      }),
    },

    /** `POST /api/workflows/[id]/publish`: go live, with the editor's checks. */
    workflowPublish: {
      POST: apiIdRoute("manage", "Workflow publish", "Workflow published via API", async (_projectId, id, _body, principal) => {
        const workflow = await services().workflow.publish(principal, id);
        return {
          response: deprecated(
            NextResponse.json({ success: true, data: { id: workflow.id, status: workflow.status } }),
            `/api/v1/automations/${id}/publish`,
          ),
          log: { workflowId: id },
        };
      }),
    },

    /** `POST /api/triggered`: send one triggered email. */
    triggered: {
      POST: apiRoute("send", "Triggered email", "Triggered email queued via API", async (projectId, body) => {
        const result = await services().trigger.sendFromRequest(projectId, body);
        return {
          response: NextResponse.json({ success: true, message: "Email queued successfully" }),
          log: { jobId: result.jobId },
        };
      }),
    },

    /** `GET /api/t/o/[token]`: open pixel. The token is sealed, so a forged one records nothing. */
    trackOpen: {
      GET: (async (request, { params }) => {
        const { token } = await params;
        const tracking = services().tracking;
        const recipient = await tracking.resolveOpen(token);

        if (recipient) {
          // Fire and forget: the image must not wait for the database.
          void tracking
            .trackOpen(recipient.campaignId, recipient.email, requestMetadata(request))
            .then((result) => {
              if (!result.success) {
                host.logger.error("Failed to track open", {
                  error: result.error,
                  campaignId: recipient.campaignId,
                });
              }
            });
        }

        // Always an image: a broken one in the message helps nobody.
        return pixelResponse();
      }) satisfies ParamHandler<{ token: string }>,
    },

    /**
     * `GET /api/t/c/[token]?url=&s=`: click redirect. The destination is
     * signed together with the recipient token, so `url` cannot be swapped:
     * an unsigned or altered destination is shown, not followed, and nothing
     * is recorded.
     */
    trackClick: {
      GET: (async (request, { params }) => {
        const { token } = await params;
        const { searchParams } = new URL(request.url);
        const url = searchParams.get("url");
        const signature = searchParams.get("s") ?? "";

        if (!url) {
          return new NextResponse("Invalid request", { status: 400 });
        }

        const tracking = services().tracking;
        const click = await tracking.resolveClick(token, url, signature);
        if (!click.follow) {
          return confirmLeavingResponse(url);
        }

        const result = await tracking.trackClick(click.campaignId, click.email, url, requestMetadata(request));
        if (!result.success) {
          host.logger.error("Failed to track click", { error: result.error, campaignId: click.campaignId });
        }

        return NextResponse.redirect(url);
      }) satisfies ParamHandler<{ token: string }>,
    },

    /**
     * `GET /api/track/open/[campaignId]/[email]`: open pixel from mail sent
     * before tracking links were sealed. Its campaign and address are in the
     * URL in the clear, so it still answers with an image but records nothing.
     */
    legacyTrackOpen: {
      GET: (async () => pixelResponse()) satisfies Handler,
    },

    /**
     * `GET /api/track/click/[campaignId]/[email]?url=`: click link from mail
     * sent before links were signed. Redirects only to a destination found in
     * one of the campaign's templates; anything else is shown on a page.
     * Nothing is recorded: campaign and address are not verified.
     */
    legacyTrackClick: {
      GET: (async (request, { params }) => {
        const { campaignId } = await params;
        const url = new URL(request.url).searchParams.get("url");

        if (!url) {
          return new NextResponse("Invalid request", { status: 400 });
        }

        if (await services().tracking.isLegacyClickTarget(Number(campaignId), url)) {
          return NextResponse.redirect(url);
        }
        return confirmLeavingResponse(url);
      }) satisfies ParamHandler<{ campaignId: string; email: string }>,
    },

    /**
     * `POST /api/unsubscribe/[token]`: one-click unsubscribe, the address the
     * List-Unsubscribe header points at. Gmail and Yahoo require it to act on
     * a POST without asking the recipient to confirm or sign in.
     */
    unsubscribeOneClick: {
      POST: (async (request, { params }) => {
        const limited = await host.rateLimit.limitRequest(request, "oneClick");
        if (limited) return limited;

        const { token } = await params;

        try {
          const result = await services().unsubscribe.process(token);

          if (!result.ok) {
            if (result.reason === "confirm_email") {
              // A legacy unsigned link: one-click cannot prove who is asking,
              // so the recipient has to open the page and confirm the address.
              return new NextResponse("Open the unsubscribe link in a browser to confirm", { status: 400 });
            }
            return new NextResponse(result.reason === "invalid" ? "Invalid token" : "Recipient not found", {
              status: result.reason === "invalid" ? 400 : 404,
            });
          }

          return new NextResponse("Unsubscribed", { status: 200 });
        } catch (error) {
          logError(host.logger, "One-click unsubscribe failed", error);
          return new NextResponse("Unsubscribe failed", { status: 500 });
        }
      }) satisfies ParamHandler<{ token: string }>,
    },

    /** `POST /api/upload`: an editor image for the signed-in user. */
    upload: {
      POST: userRoute("upload", async (userId, req) => {
        try {
          const formData = await req.formData();
          const file = formData.get("file");
          if (!(file instanceof File)) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
          }

          const upload = services().upload;
          // Size first, before the whole file is read into memory.
          upload.assertSize(file.size);
          const { url } = await upload.storeImage(new Uint8Array(await file.arrayBuffer()));
          return NextResponse.json({ url });
        } catch (error) {
          logError(host.logger, "Upload failed", error, { userId });
          return errorResponse(error);
        }
      }),
    },

    /** `POST /api/ai/generate`: a design from a prompt, through the workspace's AI provider. */
    aiGenerate: {
      POST: userRoute("ai", async (userId, req) => {
        try {
          const body = await req.json().catch(() => ({}));
          const design = await services().aiDesign.generate(userId, body);
          return NextResponse.json({ design });
        } catch (error) {
          logError(host.logger, "AI generation failed", error, { userId });
          return errorResponse(error, "Failed to generate template");
        }
      }),
    },

    /** `POST /api/webhooks/resend`. */
    webhookResend: {
      POST: ((req) => handleProviderWebhook(host, req, "RESEND")) satisfies Handler,
    },

    /** `POST /api/webhooks/postmark`. */
    webhookPostmark: {
      POST: ((req) => handleProviderWebhook(host, req, "POSTMARK")) satisfies Handler,
    },

    /** `POST /api/webhooks/groundmail`. */
    webhookGroundmail: {
      POST: ((req) => handleProviderWebhook(host, req, "GROUNDMAIL")) satisfies Handler,
    },

    /** `POST /api/webhooks/sendgrid`. */
    webhookSendgrid: {
      POST: ((req) => handleProviderWebhook(host, req, "SENDGRID")) satisfies Handler,
    },

    /** `POST /api/webhooks/mailjet`. */
    webhookMailjet: {
      POST: ((req) => handleProviderWebhook(host, req, "MAILJET")) satisfies Handler,
    },

    /**
     * `POST /api/webhooks/ses?provider=<id>`: SES events delivered by SNS,
     * and SNS's subscription handshake. SNS posts `text/plain`.
     */
    webhookSes: {
      POST: ((req) => handleProviderWebhook(host, req, "SES")) satisfies Handler,
    },

    /**
     * `POST /api/debug/check`: test target for automation "API Check" nodes.
     * 200 (YES) when the email contains "pass", `metadata.test_check` is true
     * or `metadata.tags` has "test-pass"; 400 (NO) otherwise. Public on
     * purpose: the automation worker calls it server to server. Reads nothing
     * but the request, and logs nothing (the body is a real contact).
     */
    debugCheck: {
      POST: (async (req) => {
        try {
          const body = await req.json();
          const { email, metadata, meta } = body;
          // Metadata may arrive as a JSON string.
          let effective = metadata || meta || {};
          if (typeof effective === "string") {
            try {
              effective = JSON.parse(effective);
            } catch {
              effective = {};
            }
          }

          const shouldPass =
            (typeof email === "string" && email.includes("pass")) ||
            effective.test_check === true ||
            (Array.isArray(effective.tags) && effective.tags.includes("test-pass"));

          return shouldPass
            ? NextResponse.json({ result: "YES", message: "Debug check passed" }, { status: 200 })
            : NextResponse.json({ result: "NO", message: "Debug check failed" }, { status: 400 });
        } catch {
          return NextResponse.json({ error: "Invalid request" }, { status: 500 });
        }
      }) satisfies Handler,
    },
  };
}

export type SenloRoutes = ReturnType<typeof createSenloRoutes>;
