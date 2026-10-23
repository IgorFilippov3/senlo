// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@senlo/core";
import { validateApiKey } from "./api-auth";
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

  /** Rate limit and API key, then the body; shared by the two public API routes. */
  const apiRoute =
    (
      label: string,
      success: string,
      run: (projectId: number, body: unknown) => Promise<{ response: Response; log: Record<string, unknown> }>,
    ): Handler =>
    async (req) => {
      const limited = await host.rateLimit.limitRequest(req, "api");
      if (limited) return limited;

      const auth = await validateApiKey(host, req);
      if (!auth.success) return auth.response;
      const projectId = auth.apiKey.projectId;

      try {
        const body = await req.json().catch(() => ({}));
        const { response, log } = await run(projectId, body);
        host.logger.info(success, { ...log, projectId });
        return response;
      } catch (error) {
        logError(host.logger, `${label} API error`, error, { projectId });
        return errorResponse(error);
      }
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
    /** `POST /api/events`: the universal trigger. */
    events: {
      POST: apiRoute("Event", "Event processed via API", async (projectId, body) => {
        const { event, contact } = await services().events.ingest(projectId, body);
        return {
          response: NextResponse.json({ success: true, data: contact }),
          log: { event: event.event },
        };
      }),
    },

    /** `POST /api/triggered`: send one triggered email. */
    triggered: {
      POST: apiRoute("Triggered email", "Triggered email queued via API", async (projectId, body) => {
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
