import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { WebhookService } from "../services/webhook/webhookService";
import {
  SENDGRID_SIGNATURE_HEADER,
  SENDGRID_TIMESTAMP_HEADER,
  SENDGRID_MAX_AGE_SECONDS,
  derToP1363,
  isFreshTimestamp,
  sendGridMessageId,
} from "../services/webhook/sendgrid";
import { SendGridMailer, parseSendGridAddress } from "../services/mail/sendgridMailer";
import type { Logger } from "../logger";
import type { CampaignEvent, EmailProvider, Project, Suppression, TriggeredSendLog } from "../domain";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  // As SendGrid shows it: base64 SPKI DER, no PEM armor.
  const verificationKey = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  return { verificationKey, privateKey };
}

/** Signs like SendGrid: DER ECDSA over timestamp + raw body. */
const nowSeconds = () => String(Math.floor(Date.now() / 1000));

function signed(body: string, privateKey: ReturnType<typeof keyPair>["privateKey"], timestamp = nowSeconds()) {
  const signature = sign("sha256", Buffer.from(timestamp + body), privateKey).toString("base64");
  return { [SENDGRID_SIGNATURE_HEADER]: signature, [SENDGRID_TIMESTAMP_HEADER]: timestamp };
}

function event(type: string, projectId: string, extra: Record<string, unknown> = {}) {
  return {
    email: "bob@example.com",
    event: type,
    sg_message_id: "abc123XYZ.filterdrecv-5bd9-1-62F1-0",
    project_id: projectId,
    campaign_id: "100",
    contact_id: "0",
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
      findById: async (id: number) =>
        id === 100 ? ({ id, projectId: 1 } as never) : id === 200 ? ({ id, projectId: 2 } as never) : null,
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
  const service = new WebhookService(repos as never, silent);
  return { service, projects, providers, logs, suppressions, events, logUpdates };
}

function provider(id: number, key?: string): EmailProvider {
  return {
    id, name: "sg", type: "SENDGRID", isActive: true, createdAt: new Date(), updatedAt: new Date(),
    config: key === undefined ? { apiKey: "SG.k" } : { apiKey: "SG.k", webhook_secret: key },
  };
}

describe("SendGrid webhook", () => {
  const a = keyPair();
  const b = keyPair();
  let f: ReturnType<typeof fakes>;

  beforeEach(() => {
    f = fakes();
    f.projects.set(1, { id: 1, providerId: 10 } as Project);
    f.providers.set(10, provider(10, a.verificationKey));
  });

  it("applies a signed batch and matches the log by X-Message-Id", async () => {
    f.logs.push({ id: 5, campaignId: 100, email: "bob@example.com", status: "SUCCESS", providerMessageId: "abc123XYZ", data: {}, sentAt: new Date() });
    const body = JSON.stringify([event("delivered", "1"), event("open", "1"), event("processed", "1")]);
    const r = await f.service.handle("SENDGRID", body, signed(body, a.privateKey));
    expect(r).toMatchObject({ status: "batch_processed", notApplied: 2 });
    expect(f.logUpdates[0]).toMatchObject({ id: 5, data: { status: "DELIVERED" } });
    expect(f.events[0].metadata).toHaveProperty("sendgrid_event");
  });

  it("accepts the key with PEM armor and headers in any case", async () => {
    const pem = `-----BEGIN PUBLIC KEY-----\n${a.verificationKey}\n-----END PUBLIC KEY-----`;
    f.providers.set(10, provider(10, pem));
    const body = JSON.stringify([event("delivered", "1")]);
    const h = signed(body, a.privateKey);
    const upper = {
      "X-Twilio-Email-Event-Webhook-Signature": h[SENDGRID_SIGNATURE_HEADER],
      "X-Twilio-Email-Event-Webhook-Timestamp": h[SENDGRID_TIMESTAMP_HEADER],
    };
    expect((await f.service.handle("SENDGRID", body, upper)).status).toBe("batch_processed");
  });

  it("rejects a wrong key, a changed body, a changed timestamp and missing headers", async () => {
    const body = JSON.stringify([event("bounce", "1")]);
    expect(await f.service.handle("SENDGRID", body, signed(body, b.privateKey))).toEqual({
      status: "rejected", reason: "invalid_signature",
    });
    const h = signed(body, a.privateKey);
    const tampered = JSON.stringify([event("bounce", "1", { email: "eve@example.com" })]);
    expect((await f.service.handle("SENDGRID", tampered, h)).status).toBe("rejected");
    expect((await f.service.handle("SENDGRID", body, { ...h, [SENDGRID_TIMESTAMP_HEADER]: "1" })).status).toBe("rejected");
    expect((await f.service.handle("SENDGRID", body, {})).status).toBe("rejected");
    expect(f.suppressions).toHaveLength(0);
  });

  it("refuses everything without a verification key", async () => {
    f.providers.set(10, provider(10));
    const body = JSON.stringify([event("bounce", "1")]);
    expect(await f.service.handle("SENDGRID", body, signed(body, a.privateKey))).toEqual({
      status: "rejected", reason: "secret_not_configured",
    });
  });

  it("rejects a body that is not an array, ignores one without project tags", async () => {
    const obj = JSON.stringify(event("bounce", "1"));
    expect(await f.service.handle("SENDGRID", obj, signed(obj, a.privateKey))).toEqual({
      status: "rejected", reason: "invalid_payload",
    });
    const untagged = JSON.stringify([{ email: "x@y.z", event: "delivered", sg_message_id: "m" }]);
    expect(await f.service.handle("SENDGRID", untagged, signed(untagged, a.privateKey))).toEqual({
      status: "ignored", reason: "no_project",
    });
  });

  it("suppresses on bounce and spamreport, not on a blocked bounce", async () => {
    const body = JSON.stringify([
      event("bounce", "1", { email: "hard@example.com", type: "bounce" }),
      event("bounce", "1", { email: "soft@example.com", type: "blocked" }),
      event("spamreport", "1", { email: "spam@example.com" }),
    ]);
    await f.service.handle("SENDGRID", body, signed(body, a.privateKey));
    expect(f.suppressions.map((s) => [s.email, s.reason])).toEqual([
      ["hard@example.com", "BOUNCE"],
      ["spam@example.com", "SPAM"],
    ]);
  });

  it("suppresses a dropped address only when the reason is the address", async () => {
    const dropped = (email: string, reason: string) => event("dropped", "1", { email, reason });
    const body = JSON.stringify([
      dropped("bounced@example.com", "Bounced Address"),
      dropped("invalid@example.com", "Invalid Address"),
      dropped("spam@example.com", "Spam Reporting Address"),
      dropped("unsub@example.com", "Unsubscribed Address"),
      dropped("tpl@example.com", "Invalid"),
      dropped("hdr@example.com", "Invalid SMTPAPI header"),
      dropped("content@example.com", "Spam Content (if spam checker app enabled)"),
      dropped("quota@example.com", "Recipient List over Package Quota"),
      event("dropped", "1", { email: "noreason@example.com" }),
    ]);
    await f.service.handle("SENDGRID", body, signed(body, a.privateKey));
    expect(f.suppressions.map((s) => [s.email, s.reason])).toEqual([
      ["bounced@example.com", "BOUNCE"],
      ["invalid@example.com", "BOUNCE"],
      ["spam@example.com", "SPAM"],
    ]);
  });

  it("refuses a batch signed too long ago or in the future", async () => {
    const body = JSON.stringify([event("bounce", "1")]);
    const now = Math.floor(Date.now() / 1000);
    const old = String(now - SENDGRID_MAX_AGE_SECONDS - 60);
    const future = String(now + 3600);
    expect((await f.service.handle("SENDGRID", body, signed(body, a.privateKey, old))).status).toBe("rejected");
    expect((await f.service.handle("SENDGRID", body, signed(body, a.privateKey, future))).status).toBe("rejected");
    expect(f.suppressions).toHaveLength(0);
  });

  it("applies each project's part only if the body verifies with that project's key", async () => {
    // Project 2 is on another SendGrid account: the body signed by account A
    // must not write into it, while project 1's events still apply.
    f.projects.set(2, { id: 2, providerId: 20 } as Project);
    f.providers.set(20, provider(20, b.verificationKey));
    const body = JSON.stringify([
      event("bounce", "1", { email: "one@example.com" }),
      event("bounce", "2", { email: "two@example.com", campaign_id: "200" }),
    ]);
    const r = await f.service.handle("SENDGRID", body, signed(body, a.privateKey));
    expect(r).toMatchObject({ status: "batch_processed", notApplied: 1 });
    expect(f.suppressions).toEqual([expect.objectContaining({ projectId: 1, email: "one@example.com" })]);
  });

  it("ignores a project whose provider is another type", async () => {
    f.providers.set(10, { ...provider(10, a.verificationKey), type: "RESEND" });
    const body = JSON.stringify([event("bounce", "1")]);
    expect(await f.service.handle("SENDGRID", body, signed(body, a.privateKey))).toEqual({
      status: "ignored", reason: "provider_mismatch",
    });
  });
});

describe("SendGrid helpers", () => {
  it("checks the timestamp window", () => {
    const now = 1_800_000_000_000;
    const s = (offset: number) => String(now / 1000 + offset);
    expect(isFreshTimestamp(s(0), now)).toBe(true);
    expect(isFreshTimestamp(s(-SENDGRID_MAX_AGE_SECONDS), now)).toBe(true);
    expect(isFreshTimestamp(s(-SENDGRID_MAX_AGE_SECONDS - 1), now)).toBe(false);
    expect(isFreshTimestamp(s(60), now)).toBe(true);
    expect(isFreshTimestamp(s(3600), now)).toBe(false);
    expect(isFreshTimestamp("abc", now)).toBe(false);
    expect(isFreshTimestamp("", now)).toBe(false);
  });

  it("strips the filter suffix from sg_message_id", () => {
    expect(sendGridMessageId("abc123.filterdrecv-p3-1-5F.0")).toBe("abc123");
    expect(sendGridMessageId("abc123")).toBe("abc123");
  });

  it("refuses a signature that is not DER", () => {
    expect(derToP1363(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(derToP1363(new Uint8Array(70))).toBeNull();
  });

  it("parses addresses with and without a name", () => {
    expect(parseSendGridAddress("a@b.c")).toEqual({ email: "a@b.c" });
    expect(parseSendGridAddress("Acme <a@b.c>")).toEqual({ email: "a@b.c", name: "Acme" });
    expect(parseSendGridAddress('"Acme, Inc." <a@b.c>')).toEqual({ email: "a@b.c", name: "Acme, Inc." });
  });
});

describe("SendGridMailer.send", () => {
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

  it("sends the payload SendGrid expects and returns X-Message-Id", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202, headers: { "X-Message-Id": "abc123" } }));
    const r = await new SendGridMailer({ apiKey: "SG.k" }).send(options);
    expect(r).toEqual({ success: true, messageId: "abc123" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(init.headers.Authorization).toBe("Bearer SG.k");
    const body = JSON.parse(init.body);
    expect(body.personalizations).toEqual([
      { to: [{ email: "bob@example.com" }], custom_args: options.tags },
    ]);
    expect(body.from).toEqual({ email: "hello@acme.test", name: "Acme" });
    expect(body.reply_to).toEqual({ email: "support@acme.test" });
    expect(body.content.map((c: { type: string }) => c.type)).toEqual(["text/plain", "text/html"]);
    expect(body.headers).toEqual(options.headers);
    expect(body.tracking_settings).toEqual({
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
      subscription_tracking: { enable: false },
    });
  });

  it("sends html only when there is no text, to the EU host when asked", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    await new SendGridMailer({ apiKey: "SG.k", region: "EU" }).send({ ...options, text: undefined });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.eu.sendgrid.com/v3/mail/send");
    expect(JSON.parse(init.body).content).toEqual([{ type: "text/html", value: "<p>Hi</p>" }]);
  });

  it("returns SendGrid's error messages", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ errors: [{ message: "The from address does not match a verified Sender Identity." }] }, { status: 403 }),
    );
    const r = await new SendGridMailer({ apiKey: "SG.k" }).send(options);
    expect(r).toEqual({ success: false, error: "The from address does not match a verified Sender Identity." });
  });

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect(await new SendGridMailer({ apiKey: "SG.k" }).send(options)).toEqual({ success: false, error: "ECONNRESET" });
  });
});
