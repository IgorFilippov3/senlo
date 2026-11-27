// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { NotFoundError } from "@senlo/core";
import type { SenloHost } from "../host";
import type { SenloRateLimit } from "../rate-limit";
import { createSenloRoutes } from "../routes";

const API_KEY = {
  id: 1,
  projectId: 7,
  name: "test",
  prefix: "snl_abcdefgh",
  permissions: ["send", "manage"],
  createdAt: new Date(),
};

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

  it("passes Groundmail's raw body to the webhook service", async () => {
    const handle = vi.fn(async () => ({ status: "processed" }));
    const { routes } = fakeHost({ webhook: { handle } });

    const response = await routes.webhookGroundmail.POST(post("/api/webhooks/groundmail", { type: "email.delivered" }));

    expect(response.status).toBe(200);
    expect(handle).toHaveBeenCalledWith("GROUNDMAIL", '{"type":"email.delivered"}', expect.any(Object), {});
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

describe("key permissions on the public API", () => {
  /** A host whose only key, `snl_good`, holds exactly `permissions`. */
  const hostWith = (permissions: string[], services: Record<string, unknown>) =>
    fakeHost({
      auth: { validateApiKey: vi.fn(async (t: string) => (t === "snl_good" ? { ...API_KEY, permissions } : null)) },
      ...services,
    });

  it("refuses sending with a manage-only key, in the old error shape", async () => {
    const ingest = vi.fn();
    const sendFromRequest = vi.fn();
    const cancelFromRequest = vi.fn();
    const { routes, logger } = hostWith(["manage"], {
      events: { ingest },
      trigger: { sendFromRequest },
      automation: { cancelFromRequest },
    });

    for (const response of [
      await routes.events.POST(post("/api/events", { event: "signup" }, bearer)),
      await routes.triggered.POST(post("/api/triggered", {}, bearer)),
      await routes.automationsCancel.POST(post("/api/automations/cancel", {}, bearer)),
    ]) {
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('"send"');
      expect(body.details).toEqual({ permission: "send" });
    }
    expect(ingest).not.toHaveBeenCalled();
    expect(sendFromRequest).not.toHaveBeenCalled();
    expect(cancelFromRequest).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("Event API error", expect.objectContaining({ code: "PERMISSION_REQUIRED" }));
  });

  it("refuses the workflow import with a send-only key: the key of an app cannot rewrite automations", async () => {
    const importForProject = vi.fn();
    const publishForProject = vi.fn();
    const { routes } = hostWith(["send"], { workflow: { importForProject, publishForProject } });

    const imported = await routes.workflows.POST(post("/api/workflows", { workflow: { name: "W" } }, bearer));
    expect(imported.status).toBe(403);
    expect((await imported.json()).details).toEqual({ permission: "manage" });
    const published = await routes.workflowPublish.POST(
      post("/api/workflows/30/publish", undefined, bearer),
      params({ id: "30" }),
    );
    expect(published.status).toBe(403);
    expect(importForProject).not.toHaveBeenCalled();
    expect(publishForProject).not.toHaveBeenCalled();
  });

  it("lets a send-only key send", async () => {
    const ingest = vi.fn(async () => ({ event: { event: "signup" }, contact: { email: "a@b.c" }, duplicate: false }));
    const { routes } = hostWith(["send"], { events: { ingest } });
    expect((await routes.events.POST(post("/api/events", { event: "signup" }, bearer))).status).toBe(200);
  });
});

describe("API v1", () => {
  const principal = {
    projectId: 7,
    permissions: ["send", "manage"],
    source: "api_key",
    actor: { apiKeyId: 1 },
    client: null,
  };
  const me = {
    project: { id: 7, name: "My app" },
    permissions: ["send", "manage"],
    auth: { source: "api_key", apiKey: { id: 1, name: "test", prefix: "snl_abcdefgh" }, client: null },
  };

  function v1Host(overrides: Partial<SenloHost> = {}, p: unknown = principal) {
    const resolvePrincipal = vi.fn(async (token: string, client: string | null) =>
      token === "snl_good" ? { ...(p as object), client } : null,
    );
    const describePrincipal = vi.fn(async () => me);
    return {
      resolvePrincipal,
      describePrincipal,
      ...fakeHost({ auth: { resolvePrincipal, describePrincipal } }, overrides),
    };
  }

  it("GET /me answers { data } with the instance and a request id", async () => {
    const { routes, resolvePrincipal, logger } = v1Host();
    const response = await routes.v1Me.GET(
      new NextRequest("http://localhost/api/v1/me", { headers: { ...bearer, "Senlo-Client": "mcp/1.0.0" } }),
    );

    expect(response.status).toBe(200);
    const requestId = response.headers.get("X-Request-Id");
    expect(requestId).toMatch(/^req_[0-9a-f]{32}$/);
    expect(await response.json()).toEqual({
      data: { ...me, instance: { edition: "self-hosted", apiVersion: "v1" } },
    });
    expect(resolvePrincipal).toHaveBeenCalledWith("snl_good", "mcp/1.0.0");
    expect(logger.info).toHaveBeenCalledWith("API v1 getMe", { requestId, projectId: 7, client: "mcp/1.0.0" });
  });

  it("reports the host's edition", async () => {
    const { routes } = v1Host({ edition: "cloud" });
    const body = await (await routes.v1Me.GET(new NextRequest("http://localhost/api/v1/me", { headers: bearer }))).json();
    expect(body.data.instance).toEqual({ edition: "cloud", apiVersion: "v1" });
  });

  it("refuses a missing or wrong key in the v1 shape and counts the failure per IP", async () => {
    const { routes, rateLimit } = v1Host();

    for (const headers of [{}, { Authorization: "Bearer snl_bad" }] as Record<string, string>[]) {
      const response = await routes.v1Me.GET(new NextRequest("http://localhost/api/v1/me", { headers }));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toMatchObject({ code: "UNAUTHORIZED", requestId: response.headers.get("X-Request-Id") });
      expect(body.error.hint).toContain("Bearer");
    }
    expect(rateLimit.limitRequest).toHaveBeenCalledWith(expect.anything(), "apiAuthFailure");
    expect(rateLimit.limitRequest).not.toHaveBeenCalledWith(expect.anything(), "apiV1", expect.anything());
  });

  it("limits per key, not per IP", async () => {
    const { routes, rateLimit } = v1Host();
    await routes.v1Me.GET(new NextRequest("http://localhost/api/v1/me", { headers: bearer }));
    expect(rateLimit.limitRequest).toHaveBeenCalledWith(expect.anything(), "apiV1", "key:1");
  });

  it("answers the limiter's 429 in the v1 shape, with Retry-After", async () => {
    const limited = NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "12" } });
    const rateLimit = { limitRequest: vi.fn(async () => limited) } as unknown as SenloRateLimit;
    const { routes, describePrincipal } = v1Host({ rateLimit });

    const response = await routes.v1Me.GET(new NextRequest("http://localhost/api/v1/me", { headers: bearer }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect((await response.json()).error.code).toBe("RATE_LIMITED");
    expect(describePrincipal).not.toHaveBeenCalled();
  });

  it("refuses a key without the manage permission", async () => {
    const { routes, describePrincipal } = v1Host({}, { ...principal, permissions: ["send"] });
    const response = await routes.v1Me.GET(new NextRequest("http://localhost/api/v1/me", { headers: bearer }));

    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatchObject({
      code: "PERMISSION_REQUIRED",
      details: { permission: "manage" },
    });
    expect(describePrincipal).not.toHaveBeenCalled();
  });

  it("hides an unexpected failure behind INTERNAL_ERROR and logs it with the request id", async () => {
    const { routes, describePrincipal, logger } = v1Host();
    describePrincipal.mockRejectedValueOnce(new Error("connection refused at 10.0.0.5"));

    const response = await routes.v1Me.GET(new NextRequest("http://localhost/api/v1/me", { headers: bearer }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
    expect(logger.error).toHaveBeenCalledWith(
      "API v1 getMe failed",
      expect.objectContaining({ requestId: body.error.requestId, projectId: 7 }),
    );
  });

  it("serves the OpenAPI document without a key", async () => {
    const { routes } = v1Host();
    const response = await routes.v1OpenApi.GET();
    expect(response.status).toBe(200);
    const doc = await response.json();
    expect(doc.openapi).toBe("3.0.3");
    expect(doc.paths["/api/v1/me"].get).toBeDefined();
  });
});

describe("API v1 templates", () => {
  const principal = { projectId: 7, permissions: ["manage"], source: "api_key", actor: { apiKeyId: 1 }, client: null };
  const at = new Date("2026-11-27T10:00:00Z");
  const template = {
    id: 5,
    projectId: 7,
    name: "Reset",
    subject: "Reset your password",
    preheader: null,
    html: "<html/>",
    designJson: { version: 1, rows: [], settings: {} },
    status: "draft",
    locale: "en",
    createdAt: at,
    updatedAt: at,
  };
  const asJson = {
    id: 5,
    name: "Reset",
    subject: "Reset your password",
    preheader: null,
    locale: "en",
    status: "draft",
    createdAt: at.toISOString(),
    updatedAt: at.toISOString(),
  };

  function templatesHost(templateService: Record<string, unknown>) {
    return fakeHost({
      auth: { resolvePrincipal: vi.fn(async (t: string) => (t === "snl_good" ? principal : null)) },
      idempotency: { begin: vi.fn(async () => ({ run: true, id: 1 })), complete: vi.fn(), release: vi.fn() },
      template: templateService,
    });
  }
  const call = (method: string, path: string, body?: unknown) =>
    new NextRequest(`http://localhost${path}`, {
      method,
      headers: { ...bearer, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("lists a page without designs, passing limit and cursor", async () => {
    const listPage = vi.fn(async () => ({ items: [template], nextCursor: "abc" }));
    const { routes } = templatesHost({ listPage });

    const response = await routes.v1Templates.GET(call("GET", "/api/v1/templates?limit=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { items: [asJson], nextCursor: "abc" } });
    expect(listPage).toHaveBeenCalledWith(principal, 7, { limit: 1, beforeId: null });

    const bad = await routes.v1Templates.GET(call("GET", "/api/v1/templates?limit=500"));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.issues[0].path).toBe("limit");
  });

  it("creates with 201 and the design, or checks only on dryRun", async () => {
    const createFromApi = vi.fn(async (_p: unknown, _id: number, _b: unknown, o: { dryRun: boolean }) => (o.dryRun ? null : template));
    const { routes } = templatesHost({ createFromApi });
    const body = { name: "Reset", subject: "Reset your password", design: { rows: [] } };

    const created = await routes.v1Templates.POST(call("POST", "/api/v1/templates", body));
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ data: { ...asJson, design: template.designJson } });
    expect(createFromApi).toHaveBeenCalledWith(principal, 7, body, { dryRun: false });

    const checked = await routes.v1Templates.POST(call("POST", "/api/v1/templates?dryRun=true", body));
    expect(checked.status).toBe(200);
    expect(await checked.json()).toEqual({ data: { valid: true, warnings: [] } });
  });

  it("reads and changes one template; a malformed id is a 404 that never reaches the service", async () => {
    const getWithDesign = vi.fn(async () => ({ template, design: template.designJson }));
    const updateFromApi = vi.fn(async () => template);
    const { routes } = templatesHost({ getWithDesign, updateFromApi });

    const got = await routes.v1Template.GET(call("GET", "/api/v1/templates/5"), params({ id: "5" }));
    expect((await got.json()).data).toMatchObject({ id: 5, design: { rows: [] } });
    expect(getWithDesign).toHaveBeenCalledWith(principal, 5);

    const patched = await routes.v1Template.PATCH(call("PATCH", "/api/v1/templates/5", { subject: "New" }), params({ id: "5" }));
    expect(patched.status).toBe(200);
    expect(updateFromApi).toHaveBeenCalledWith(principal, 5, { subject: "New" }, { dryRun: false });

    for (const raw of ["x", "0", "-1", "1.5", "5e2"]) {
      const response = await routes.v1Template.GET(call("GET", `/api/v1/templates/${raw}`), params({ id: raw }));
      expect(response.status).toBe(404);
    }
    expect(getWithDesign).toHaveBeenCalledTimes(1);
  });

  it("previews and sends a test", async () => {
    const previewFromApi = vi.fn(async () => ({ subject: "Hi", html: "<html/>", text: "Hi" }));
    const sendTestFromApi = vi.fn(async () => ({ to: "a@x.io", messageId: "m-1" }));
    const { routes } = templatesHost({ previewFromApi, sendTestFromApi });

    const preview = await routes.v1TemplatePreview.POST(call("POST", "/api/v1/templates/preview", { templateId: 5 }));
    expect(await preview.json()).toEqual({ data: { subject: "Hi", html: "<html/>", text: "Hi" } });
    expect(previewFromApi).toHaveBeenCalledWith(principal, 7, { templateId: 5 });

    const sent = await routes.v1TemplateTestSend.POST(
      call("POST", "/api/v1/templates/5/test-send", { to: "a@x.io" }),
      params({ id: "5" }),
    );
    expect(await sent.json()).toEqual({ data: { sent: true, to: "a@x.io", messageId: "m-1" } });
    expect(sendTestFromApi).toHaveBeenCalledWith(principal, 5, { to: "a@x.io" });
  });
});
