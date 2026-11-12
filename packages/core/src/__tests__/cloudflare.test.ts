import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Logger } from "../logger";
import { ServiceHooks } from "../hooks";
import { EmailWorkerProcessor } from "../queue/worker";
import { MailerFactory } from "../services/mail/index";
import { CloudflareMailer, parseCloudflareAddress } from "../services/mail/cloudflareMailer";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const ACCOUNT = "0123456789abcdef0123456789abcdef";

describe("CloudflareMailer.send", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const options = {
    from: "Acme <hello@acme.test>",
    to: "Bob@Example.com",
    subject: "Hi",
    html: "<p>Hi</p>",
    text: "Hi",
    replyTo: "Support <support@acme.test>",
    headers: { "List-Unsubscribe": "<https://x/u>" },
    tags: { project_id: "1" },
  };
  const ok = (result: Record<string, string[]>) =>
    Response.json({ success: true, errors: [], messages: [], result });

  it("sends the payload Cloudflare expects", async () => {
    fetchMock.mockResolvedValue(ok({ delivered: ["bob@example.com"], permanent_bounces: [], queued: [] }));
    const r = await new CloudflareMailer({ accountId: ACCOUNT, apiToken: "t" }).send(options);
    expect(r).toEqual({ success: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/email/sending/send`);
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(init.body)).toEqual({
      to: "Bob@Example.com",
      from: { address: "hello@acme.test", name: "Acme" },
      reply_to: "support@acme.test",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      headers: options.headers,
    });
  });

  it("reports a permanent bounce as a sent message, not an error", async () => {
    fetchMock.mockResolvedValue(ok({ delivered: [], permanent_bounces: ["bob@example.com"], queued: [] }));
    expect(await new CloudflareMailer({ accountId: ACCOUNT, apiToken: "t" }).send(options)).toEqual({
      success: true,
      permanentBounce: true,
    });
  });

  it("treats queued as sent", async () => {
    fetchMock.mockResolvedValue(ok({ delivered: [], permanent_bounces: [], queued: ["bob@example.com"] }));
    expect(await new CloudflareMailer({ accountId: ACCOUNT, apiToken: "t" }).send(options)).toEqual({ success: true });
  });

  it("returns Cloudflare's errors with their codes", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { success: false, errors: [{ code: 10203, message: "email.sending.error.email.sending_disabled" }], messages: [], result: null },
        { status: 403 },
      ),
    );
    expect(await new CloudflareMailer({ accountId: ACCOUNT, apiToken: "t" }).send(options)).toEqual({
      success: false,
      error: "email.sending.error.email.sending_disabled (10203)",
      permanent: true,
    });
    fetchMock.mockResolvedValue(new Response("bad gateway", { status: 502 }));
    expect(await new CloudflareMailer({ accountId: ACCOUNT, apiToken: "t" }).send(options)).toEqual({
      success: false,
      error: "Cloudflare API error (status 502)",
      permanent: false,
    });
  });

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect(await new CloudflareMailer({ accountId: ACCOUNT, apiToken: "t" }).send(options)).toEqual({
      success: false,
      error: "ECONNRESET",
    });
  });

  it("refuses an account id that is not 32 hex characters", () => {
    expect(() => new CloudflareMailer({ accountId: "../zones", apiToken: "t" })).toThrow();
  });

  it("parses addresses", () => {
    expect(parseCloudflareAddress("a@b.c")).toBe("a@b.c");
    expect(parseCloudflareAddress("<a@b.c>")).toBe("a@b.c");
    expect(parseCloudflareAddress('"Acme, Inc." <a@b.c>')).toEqual({ address: "a@b.c", name: "Acme, Inc." });
  });
});

describe("send worker: a permanent bounce in the send response", () => {
  afterEach(() => vi.restoreAllMocks());

  function setup(result: { success: true; permanentBounce?: boolean }) {
    vi.spyOn(MailerFactory, "create").mockReturnValue({ send: async () => result } as never);
    const campaignRepo = { logEvent: vi.fn(async () => {}) };
    const logRepo = {
      findById: vi.fn(async () => ({ id: 9, status: "PENDING" })),
      update: vi.fn(async (_id: number, _data: Record<string, unknown>) => null),
    };
    const suppressions: unknown[] = [];
    const suppressionRepo = {
      findSendBlock: async () => null,
      findByProjectAndEmail: async () => (suppressions.length ? suppressions[0] : null),
      create: vi.fn(async (s: unknown) => {
        suppressions.push(s);
        return s;
      }),
    };
    const worker = new EmailWorkerProcessor(
      { appUrl: "https://app.test", linkSigningSecret: "s".repeat(32) } as never,
      campaignRepo as never,
      { findById: async () => ({ id: 7, type: "CLOUDFLARE", config: {} }) } as never,
      {} as never,
      logRepo as never,
      suppressionRepo as never,
      silent,
      ServiceHooks.none,
    );
    const job = {
      id: "j1",
      data: {
        projectId: 1, campaignId: 5, contactId: 2, logId: 9, email: "r@x.test",
        from: "a@x.test", subject: "s", providerId: 7, html: "<p>hi</p>",
      },
    } as never;
    return { worker, job, campaignRepo, logRepo, suppressionRepo };
  }

  it("records the bounce and suppresses the address without failing the job", async () => {
    const f = setup({ success: true, permanentBounce: true });
    await f.worker.processEmailJob(f.job);
    expect(f.campaignRepo.logEvent.mock.calls.map((c: any) => c[0].type)).toEqual(["SENT", "BOUNCE"]);
    expect(f.logRepo.update.mock.calls.at(-1)![1]).toMatchObject({ status: "BOUNCED" });
    expect(f.suppressionRepo.create).toHaveBeenCalledWith({ projectId: 1, email: "r@x.test", reason: "BOUNCE" });
    expect((f.campaignRepo.logEvent.mock.calls[1] as any)[0].metadata).toEqual({
      cloudflare_event: { permanent_bounce: true, at: "send" },
    });
  });

  it("does not fail the job when recording the bounce fails, so the send is not retried", async () => {
    const f = setup({ success: true, permanentBounce: true });
    f.suppressionRepo.create.mockRejectedValueOnce(new Error("db down"));
    await f.worker.processEmailJob(f.job);
    expect(f.campaignRepo.logEvent.mock.calls.map((c: any) => c[0].type)).toEqual(["SENT", "BOUNCE"]);
  });

  it("does nothing extra for a normal send", async () => {
    const f = setup({ success: true });
    await f.worker.processEmailJob(f.job);
    expect(f.campaignRepo.logEvent.mock.calls.map((c: any) => c[0].type)).toEqual(["SENT"]);
    expect(f.suppressionRepo.create).not.toHaveBeenCalled();
  });
});
