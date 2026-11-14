// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError } from "@senlo/core";
import type { SenloHost } from "../host";
import type { SenloRateLimit } from "../rate-limit";
import { createSenloRoutes } from "../routes";

const API_KEY = { id: 1, projectId: 7, name: "test", prefix: "snl_abcdefgh", createdAt: new Date() };

/** A host over fake services; only what a test touches needs to exist. */
function fakeHost(services: Record<string, unknown> = {}, overrides: Partial<SenloHost> = {}) {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const rateLimit = { limitRequest: vi.fn(async () => null) } as unknown as SenloRateLimit;
  const host: SenloHost = {
    getServices: () =>
      ({
        auth: { validateApiKey: vi.fn(async (token: string) => (token === "snl_good" ? API_KEY : null)) },
        ...services,
      }) as never,
    requireUserId: async () => "u1",
    currentUserId: async () => "u1",
    getConfig: () => ({ appUrl: "http://localhost:3000", defaultFromEmail: "hello@senlo.io" }),
    logger,
    rateLimit,
    ...overrides,
  };
  return { host, logger, rateLimit, routes: createSenloRoutes(host) };
}

const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const get = (path: string) => new NextRequest(`http://localhost${path}`);
const params = <P>(value: P) => ({ params: Promise.resolve(value) });
const bearer = { Authorization: "Bearer snl_good" };

describe("events and triggered", () => {
  it("refuses a request without a key or with a wrong one", async () => {
    const ingest = vi.fn();
    const { routes } = fakeHost({ events: { ingest } });

    expect((await routes.events.POST(post("/api/events", {}))).status).toBe(401);
    expect(
      (await routes.events.POST(post("/api/events", {}, { Authorization: "Bearer snl_bad" }))).status,
    ).toBe(401);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("ingests for the key's project and logs the success", async () => {
    const ingest = vi.fn(async () => ({ event: { event: "signup" }, contact: { email: "a@b.c" }, duplicate: false }));
    const { routes, logger } = fakeHost({ events: { ingest } });

    const response = await routes.events.POST(post("/api/events", { event: "signup" }, bearer));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { email: "a@b.c" } });
    expect(ingest).toHaveBeenCalledWith(7, { event: "signup" }, { idempotencyKey: null });
    expect(logger.info).toHaveBeenCalledWith("Event processed via API", { event: "signup", projectId: 7 });
  });

  it("passes the Idempotency-Key header and answers a repeat with 200", async () => {
    const ingest = vi.fn(async () => ({ event: { event: "signup" }, contact: { email: "a@b.c" }, duplicate: true }));
    const { routes, logger } = fakeHost({ events: { ingest } });

    const response = await routes.events.POST(
      post("/api/events", { event: "signup" }, { ...bearer, "Idempotency-Key": "k-1" }),
    );

    expect(response.status).toBe(200);
    expect(ingest).toHaveBeenCalledWith(7, { event: "signup" }, { idempotencyKey: "k-1" });
    expect(logger.info).toHaveBeenCalledWith("Event processed via API", {
      event: "signup",
      duplicate: true,
      projectId: 7,
    });
  });

  it("answers a service error with its status and logs it as a warning", async () => {
    const sendFromRequest = vi.fn(async () => {
      throw new NotFoundError("Trigger");
    });
    const { routes, logger } = fakeHost({ trigger: { sendFromRequest } });

    const response = await routes.triggered.POST(post("/api/triggered", { trigger: "x" }, bearer));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "Trigger not found" });
    expect(logger.warn).toHaveBeenCalledWith(
      "Triggered email API error",
      expect.objectContaining({ code: "NOT_FOUND", projectId: 7 }),
    );
  });

  it("cancels runs for the key's project", async () => {
    const cancelFromRequest = vi.fn(async () => ({ cancelled: 2 }));
    const { routes, logger } = fakeHost({ automation: { cancelFromRequest } });

    const unauthorized = await routes.automationsCancel.POST(post("/api/automations/cancel", { email: "a@b.c" }));
    expect(unauthorized.status).toBe(401);

    const response = await routes.automationsCancel.POST(post("/api/automations/cancel", { email: "a@b.c" }, bearer));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { cancelled: 2 } });
    expect(cancelFromRequest).toHaveBeenCalledWith(7, { email: "a@b.c" });
    expect(logger.info).toHaveBeenCalledWith("Automation runs cancelled via API", { cancelled: 2, projectId: 7 });
  });

  it("returns the limiter's response before touching the key", async () => {
    const { routes, rateLimit, host } = fakeHost();
    vi.mocked(rateLimit.limitRequest).mockResolvedValueOnce(new Response(null, { status: 429 }) as never);
    const validate = vi.spyOn(host, "getServices");

    expect((await routes.events.POST(post("/api/events", {}, bearer))).status).toBe(429);
    expect(validate).not.toHaveBeenCalled();
  });
});

describe("tracking", () => {
  it("follows a signed click and records it", async () => {
    const trackClick = vi.fn(async () => ({ success: true }));
    const { routes } = fakeHost({
      tracking: {
        resolveClick: vi.fn(async () => ({ follow: true, campaignId: 3, email: "a@b.c" })),
        trackClick,
      },
    });

    const response = await routes.trackClick.GET(
      get("/api/t/c/tok?url=https%3A%2F%2Fexample.com&s=sig"),
      params({ token: "tok" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/");
    expect(trackClick).toHaveBeenCalledWith(3, "a@b.c", "https://example.com", expect.any(Object));
  });

  it("shows an altered destination instead of following it, and records nothing", async () => {
    const trackClick = vi.fn();
    const { routes } = fakeHost({
      tracking: { resolveClick: vi.fn(async () => ({ follow: false })), trackClick },
    });

    const response = await routes.trackClick.GET(
      get("/api/t/c/tok?url=https%3A%2F%2Fevil.example&s=forged"),
      params({ token: "tok" }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("This link could not be verified");
    expect(trackClick).not.toHaveBeenCalled();
  });

  it("refuses a click without a destination", async () => {
    const { routes } = fakeHost({ tracking: {} });
    expect((await routes.trackClick.GET(get("/api/t/c/tok"), params({ token: "tok" }))).status).toBe(400);
  });

  it("always answers the open pixel with an uncached image", async () => {
    const { routes } = fakeHost({ tracking: { resolveOpen: vi.fn(async () => null) } });
    const response = await routes.trackOpen.GET(get("/api/t/o/forged"), params({ token: "forged" }));

    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("redirects a legacy click only to a destination from the campaign", async () => {
    const isLegacyClickTarget = vi.fn(async (_id: number, url: string) => url === "https://ok.example");
    const { routes } = fakeHost({ tracking: { isLegacyClickTarget } });
    const ctx = params({ campaignId: "5", email: "a@b.c" });

    const ok = await routes.legacyTrackClick.GET(get("/api/track/click/5/a?url=https%3A%2F%2Fok.example"), ctx);
    const other = await routes.legacyTrackClick.GET(get("/api/track/click/5/a?url=https%3A%2F%2Fevil.example"), ctx);

    expect(ok.status).toBe(307);
    expect(other.status).toBe(200);
    expect(isLegacyClickTarget).toHaveBeenCalledWith(5, "https://ok.example");
  });
});

describe("webhooks", () => {
  const webhookHost = (handle: () => Promise<unknown>) => fakeHost({ webhook: { handle: vi.fn(handle) } });

  it.each([
    ["invalid_payload", 400],
    ["secret_not_configured", 401],
    ["invalid_signature", 401],
  ])("answers a %s rejection with %i", async (reason, status) => {
    const { routes } = webhookHost(async () => ({ status: "rejected", reason }));
    expect((await routes.webhookResend.POST(post("/api/webhooks/resend", {}))).status).toBe(status);
  });

  it("accepts a handled webhook and passes the raw body to the service", async () => {
    const handle = vi.fn(async () => ({ status: "processed" }));
    const { routes } = fakeHost({ webhook: { handle } });

    const response = await routes.webhookPostmark.POST(post("/api/webhooks/postmark", { RecordType: "Delivery" }));

    expect(response.status).toBe(200);
    expect(handle).toHaveBeenCalledWith("POSTMARK", '{"RecordType":"Delivery"}', expect.any(Object), {});
  });

  it("passes SNS's text/plain body and the URL query to the SES handler", async () => {
    const handle = vi.fn(async () => ({ status: "ignored", reason: "subscription_confirmed" }));
    const { routes } = fakeHost({ webhook: { handle } });
    const body = JSON.stringify({ Type: "SubscriptionConfirmation" });
    const req = new NextRequest("http://localhost/api/webhooks/ses?provider=12", {
      method: "POST",
      headers: { "content-type": "text/plain; charset=UTF-8", "x-amz-sns-message-type": "SubscriptionConfirmation" },
      body,
    });

    const response = await routes.webhookSes.POST(req);

    expect(response.status).toBe(200);
    expect(handle).toHaveBeenCalledWith("SES", body, expect.any(Object), { provider: "12" });
  });

  it("answers a failing service with a 500 and logs the fault", async () => {
    const { routes, logger } = webhookHost(async () => {
      throw new Error("db down");
    });
    expect((await routes.webhookResend.POST(post("/api/webhooks/resend", {}))).status).toBe(500);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("one-click unsubscribe", () => {
  const unsubscribe = async (result: unknown) => {
    const { routes } = fakeHost({
      unsubscribe: {
        process: vi.fn(async () => {
          if (result instanceof Error) throw result;
          return result;
        }),
      },
    });
    const response = await routes.unsubscribeOneClick.POST(post("/api/unsubscribe/tok"), params({ token: "tok" }));
    return { status: response.status, text: await response.text() };
  };

  it("maps every outcome to its status", async () => {
    expect(await unsubscribe({ ok: true })).toEqual({ status: 200, text: "Unsubscribed" });
    expect((await unsubscribe({ ok: false, reason: "invalid" })).status).toBe(400);
    expect((await unsubscribe({ ok: false, reason: "not_found" })).status).toBe(404);
    expect(await unsubscribe({ ok: false, reason: "confirm_email" })).toEqual({
      status: 400,
      text: "Open the unsubscribe link in a browser to confirm",
    });
    expect((await unsubscribe(new Error("db down"))).status).toBe(500);
  });
});

describe("signed-in routes", () => {
  it("refuse upload and AI generation without a session", async () => {
    const { routes } = fakeHost({}, { currentUserId: async () => null });
    expect((await routes.upload.POST(post("/api/upload"))).status).toBe(401);
    expect((await routes.aiGenerate.POST(post("/api/ai/generate", {}))).status).toBe(401);
  });

  it("limit AI generation per user", async () => {
    const generate = vi.fn(async () => ({ rows: [] }));
    const { routes, rateLimit } = fakeHost({ aiDesign: { generate } });

    const response = await routes.aiGenerate.POST(post("/api/ai/generate", { prompt: "hi" }));

    expect(response.status).toBe(200);
    expect(rateLimit.limitRequest).toHaveBeenCalledWith(expect.anything(), "ai", "user:u1");
    expect(generate).toHaveBeenCalledWith("u1", { prompt: "hi" });
  });
});

describe("debug check", () => {
  it("passes on the documented markers and fails otherwise", async () => {
    const { routes } = fakeHost();
    const check = async (body: unknown) => (await routes.debugCheck.POST(post("/api/debug/check", body))).status;

    expect(await check({ email: "pass@x.y" })).toBe(200);
    expect(await check({ email: "a@x.y", metadata: { test_check: true } })).toBe(200);
    expect(await check({ email: "a@x.y", meta: '{"tags":["test-pass"]}' })).toBe(200);
    expect(await check({ email: "a@x.y" })).toBe(400);
  });
});

describe("workflows API", () => {
  it("creates a draft from an export for the key's project", async () => {
    const importForProject = vi.fn(async () => ({ id: 30, status: "DRAFT" }));
    const { routes } = fakeHost({ workflow: { importForProject } });

    expect((await routes.workflows.POST(post("/api/workflows", { workflow: {} }))).status).toBe(401);
    const response = await routes.workflows.POST(post("/api/workflows", { workflow: { name: "W" } }, bearer));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, data: { id: 30, status: "DRAFT" } });
    expect(importForProject).toHaveBeenCalledWith(7, { workflow: { name: "W" } });
  });

  it("exports and publishes by id; a malformed id or another project's workflow is a 404", async () => {
    const exportForProject = vi.fn(async (_projectId: number, id: number) => {
      if (id !== 30) throw new NotFoundError("Workflow");
      return { format: "senlo.workflow", version: 1, name: "W" };
    });
    const publishForProject = vi.fn(async () => ({ id: 30, status: "ACTIVE" }));
    const { routes } = fakeHost({ workflow: { exportForProject, publishForProject } });
    const authed = (path: string) => new NextRequest(`http://localhost${path}`, { headers: bearer });

    const exported = await routes.workflow.GET(authed("/api/workflows/30"), params({ id: "30" }));
    expect(exported.status).toBe(200);
    expect((await exported.json()).data).toMatchObject({ format: "senlo.workflow" });
    expect(exportForProject).toHaveBeenCalledWith(7, 30);

    expect((await routes.workflow.GET(authed("/api/workflows/31"), params({ id: "31" }))).status).toBe(404);
    expect((await routes.workflow.GET(authed("/api/workflows/x"), params({ id: "x" }))).status).toBe(404);

    const published = await routes.workflowPublish.POST(post("/api/workflows/30/publish", undefined, bearer), params({ id: "30" }));
    expect(await published.json()).toEqual({ success: true, data: { id: 30, status: "ACTIVE" } });
    expect(publishForProject).toHaveBeenCalledWith(7, 30);
  });
});
