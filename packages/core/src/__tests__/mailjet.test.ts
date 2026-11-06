import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebhookService } from "../services/webhook/webhookService";
import { readBasicPassword, readMailjetPayload } from "../services/webhook/mailjet";
import { MailjetMailer, parseMailjetAddress } from "../services/mail/mailjetMailer";
import type { Logger } from "../logger";
import type { CampaignEvent, EmailProvider, Project, Suppression, TriggeredSendLog } from "../domain";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const SECRET = "s3cret-for-mailjet";

const basic = (password: string, user = "senlo") => ({
  authorization: "Basic " + Buffer.from(`${user}:${password}`).toString("base64"),
});

function event(type: string, projectId: string, extra: Record<string, unknown> = {}) {
  return {
    event: type,
    time: 1700000000,
    MessageID: 19421777835146490,
    Message_GUID: "1ab23cd4-e567-8901-2345-6789f0gh1i2j",
    email: "bob@example.com",
    Payload: JSON.stringify({ project_id: projectId, campaign_id: "100", contact_id: "0" }),
    ...extra,
  };
}

function fakes() {
  const projects = new Map<number, Project>();
  const providers = new Map<number, EmailProvider>();
  const logs: TriggeredSendLog[] = [];
  const suppressions: Suppression[] = [];
  const events: Omit<CampaignEvent, "id" | "occurredAt">[] = [];
  const logUpdates: { id: number; data: Partial<TriggeredSendLog> }[] = [];
  const repos = {
    projects: { findById: async (id: number) => projects.get(id) ?? null },
    providers: { findById: async (id: number) => providers.get(id) ?? null },
    campaigns: {
      findById: async (id: number) => (id === 100 ? ({ id, projectId: 1 } as never) : null),
      logEvent: async (data: Omit<CampaignEvent, "id" | "occurredAt">) => {
        events.push(data);
        return data as never;
      },
    },
    contacts: { findById: async () => null },
    sendLogs: {
      findByProviderMessageId: async (mid: string) => logs.find((l) => l.providerMessageId === mid) ?? null,
      findLatestByCampaignAndEmail: async () => null,
      update: async (id: number, data: Partial<TriggeredSendLog>) => {
        logUpdates.push({ id, data });
        return null;
      },
    },
    suppressions: {
      findByProjectAndEmail: async (p: number, e: string) =>
        suppressions.find((s) => s.projectId === p && s.email === e) ?? null,
      create: async (data: Omit<Suppression, "id" | "createdAt">) => {
        const s = { ...data, id: suppressions.length + 1, createdAt: new Date() };
        suppressions.push(s);
        return s;
      },
    },
  };
  return { service: new WebhookService(repos as never, silent), projects, providers, logs, suppressions, events, logUpdates };
}

function provider(id: number, secret?: string): EmailProvider {
  return {
    id, name: "mj", type: "MAILJET", isActive: true, createdAt: new Date(), updatedAt: new Date(),
    config: { apiKey: "k", apiSecret: "s", region: "GLOBAL", ...(secret === undefined ? {} : { webhook_secret: secret }) },
  };
}

describe("Mailjet webhook", () => {
  let f: ReturnType<typeof fakes>;
  beforeEach(() => {
    f = fakes();
    f.projects.set(1, { id: 1, providerId: 10 } as Project);
    f.providers.set(10, provider(10, SECRET));
  });

  it("applies a single event and matches the log by Message_GUID", async () => {
    f.logs.push({ id: 5, campaignId: 100, email: "bob@example.com", status: "SUCCESS", providerMessageId: "1ab23cd4-e567-8901-2345-6789f0gh1i2j", data: {}, sentAt: new Date() });
    const body = JSON.stringify(event("sent", "1"));
    const r = await f.service.handle("MAILJET", body, basic(SECRET));
    expect(r).toMatchObject({ status: "batch_processed", notApplied: 0 });
    expect(f.logUpdates[0]).toMatchObject({ id: 5, data: { status: "DELIVERED" } });
    expect(f.events[0].metadata).toHaveProperty("mailjet_event");
  });

  it("accepts grouped events (an array)", async () => {
    const body = JSON.stringify([event("sent", "1"), event("open", "1"), event("spam", "1", { email: "spam@example.com" })]);
    const r = await f.service.handle("MAILJET", body, basic(SECRET));
    expect(r).toMatchObject({ status: "batch_processed", notApplied: 1 });
    expect(f.suppressions.map((s) => [s.email, s.reason])).toEqual([["spam@example.com", "SPAM"]]);
  });

  it("checks the basic auth password, whatever the header case and user name", async () => {
    const body = JSON.stringify(event("sent", "1"));
    expect((await f.service.handle("MAILJET", body, {})).status).toBe("rejected");
    expect((await f.service.handle("MAILJET", body, basic("wrong"))).status).toBe("rejected");
    expect((await f.service.handle("MAILJET", body, { authorization: "Bearer " + SECRET })).status).toBe("rejected");
    const ok = { Authorization: basic(SECRET, "anyone").authorization };
    expect((await f.service.handle("MAILJET", body, ok)).status).toBe("batch_processed");
  });

  it("refuses everything without a webhook secret", async () => {
    f.providers.set(10, provider(10));
    const body = JSON.stringify(event("bounce", "1", { hard_bounce: true, error_related_to: "recipient", error: "user unknown" }));
    expect(await f.service.handle("MAILJET", body, basic(SECRET))).toEqual({
      status: "rejected", reason: "secret_not_configured",
    });
  });

  it("ignores events without a Payload", async () => {
    const body = JSON.stringify({ ...event("sent", "1"), Payload: "" });
    expect(await f.service.handle("MAILJET", body, basic(SECRET))).toEqual({ status: "ignored", reason: "no_project" });
  });

  it("suppresses only for permanent errors about the address", async () => {
    const bounce = (email: string, related: string, error: string, hard = true) =>
      event("bounce", "1", { email, hard_bounce: hard, error_related_to: related, error });
    const blocked = (email: string, related: string, error: string) =>
      event("blocked", "1", { email, error_related_to: related, error });
    const body = JSON.stringify([
      bounce("unknown@example.com", "recipient", "user unknown"),
      bounce("inactive@example.com", "recipient", "mailbox inactive"),
      bounce("nodomain@example.com", "domain", "invalid domain"),
      bounce("soft@example.com", "recipient", "user unknown", false),
      bounce("full@example.com", "recipient", "quota exceeded"),
      bounce("relay@example.com", "domain", "relay/access denied"),
      bounce("content@example.com", "spam", "content blocked"),
      blocked("pre@example.com", "mailjet", "preblocked"),
      blocked("reporter@example.com", "recipient", "spam reporter"),
      blocked("dup@example.com", "mailjet", "duplicate in campaign"),
      blocked("tpl@example.com", "content", "error in template language"),
    ]);
    await f.service.handle("MAILJET", body, basic(SECRET));
    expect(f.suppressions.map((s) => [s.email, s.reason])).toEqual([
      ["unknown@example.com", "BOUNCE"],
      ["inactive@example.com", "BOUNCE"],
      ["nodomain@example.com", "BOUNCE"],
      ["pre@example.com", "BOUNCE"],
      ["reporter@example.com", "SPAM"],
    ]);
  });

  it("does not use Mailjet's open, click and unsub events", async () => {
    const body = JSON.stringify([event("open", "1"), event("click", "1"), event("unsub", "1")]);
    expect(await f.service.handle("MAILJET", body, basic(SECRET))).toEqual({ status: "ignored", reason: "untracked_event" });
  });
});

describe("Mailjet helpers", () => {
  it("reads the basic auth password", () => {
    expect(readBasicPassword(basic("p:with:colons").authorization)).toBe("p:with:colons");
    expect(readBasicPassword("Basic !!!")).toBeNull();
    expect(readBasicPassword("Basic " + btoa("nocolon"))).toBeNull();
    expect(readBasicPassword(undefined)).toBeNull();
  });

  it("reads the payload and survives a broken one", () => {
    expect(readMailjetPayload({ Payload: '{"project_id":"1"}' })).toEqual({ project_id: "1" });
    expect(readMailjetPayload({ Payload: "not json" })).toEqual({});
    expect(readMailjetPayload({ Payload: "[1]" })).toEqual({});
    expect(readMailjetPayload({})).toEqual({});
  });

  it("parses addresses", () => {
    expect(parseMailjetAddress("a@b.c")).toEqual({ Email: "a@b.c" });
    expect(parseMailjetAddress('"Acme, Inc." <a@b.c>')).toEqual({ Email: "a@b.c", Name: "Acme, Inc." });
  });
});

describe("MailjetMailer.send", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const options = {
    from: "Acme <hello@acme.test>",
    to: "bob@example.com",
    subject: "Hi",
    html: "<p>Hi</p>",
    text: "Hi",
    replyTo: "support@acme.test",
    headers: { "List-Unsubscribe": "<https://x/u>" },
    tags: { project_id: "1", campaign_id: "100", contact_id: "0" },
  };
  // MessageID is a number above 2^53, as Mailjet sends it.
  const ok = '{"Messages":[{"Status":"success","To":[{"Email":"bob@example.com","MessageUUID":"uuid-1","MessageID":288230376454555555,"MessageHref":"https://api.mailjet.com/v3/REST/message/288230376454555555"}]}]}';

  it("sends the payload Mailjet expects and returns MessageUUID", async () => {
    fetchMock.mockResolvedValue(new Response(ok, { status: 200 }));
    const r = await new MailjetMailer({ apiKey: "k", apiSecret: "s" }).send(options);
    expect(r).toEqual({ success: true, messageId: "uuid-1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mailjet.com/v3.1/send");
    expect(init.headers.Authorization).toBe("Basic " + Buffer.from("k:s").toString("base64"));
    const [message] = JSON.parse(init.body).Messages;
    expect(message).toMatchObject({
      From: { Email: "hello@acme.test", Name: "Acme" },
      To: [{ Email: "bob@example.com" }],
      ReplyTo: { Email: "support@acme.test" },
      Subject: "Hi",
      TextPart: "Hi",
      HTMLPart: "<p>Hi</p>",
      Headers: options.headers,
      TrackOpens: "disabled",
      TrackClicks: "disabled",
    });
    expect(JSON.parse(message.EventPayload)).toEqual(options.tags);
  });

  it("falls back to the id in MessageHref, kept exact, and uses the US host", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"Messages":[{"Status":"success","To":[{"MessageID":288230376454555555,"MessageHref":"https://api.us.mailjet.com/v3/REST/message/288230376454555555"}]}]}'),
    );
    const r = await new MailjetMailer({ apiKey: "k", apiSecret: "s", region: "US" }).send(options);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.us.mailjet.com/v3.1/send");
    expect(r).toEqual({ success: true, messageId: "288230376454555555" });
  });

  it("returns Mailjet's error messages", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { Messages: [{ Status: "error", Errors: [{ ErrorCode: "mj-0013", StatusCode: 400, ErrorMessage: "\"bob\" is an invalid email address." }] }] },
        { status: 400 },
      ),
    );
    expect(await new MailjetMailer({ apiKey: "k", apiSecret: "s" }).send(options)).toEqual({
      success: false, error: "\"bob\" is an invalid email address.",
    });
    fetchMock.mockResolvedValue(Response.json({ ErrorMessage: "API key authentication/authorization failure.", StatusCode: 401 }, { status: 401 }));
    expect(await new MailjetMailer({ apiKey: "k", apiSecret: "s" }).send(options)).toEqual({
      success: false, error: "API key authentication/authorization failure.",
    });
  });

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect(await new MailjetMailer({ apiKey: "k", apiSecret: "s" }).send(options)).toEqual({ success: false, error: "ECONNRESET" });
  });
});
