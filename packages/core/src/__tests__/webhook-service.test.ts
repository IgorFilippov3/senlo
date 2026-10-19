import { describe, it, expect, beforeEach, vi } from "vitest";
import { Webhook } from "svix";
import { WebhookService } from "../services/webhook/webhookService";
import { readResendTags } from "../services/webhook/resend";
import { POSTMARK_SECRET_HEADER } from "../services/webhook/postmark";
import type { Logger } from "../logger";
import type {
  Campaign,
  CampaignEvent,
  Contact,
  EmailProvider,
  Project,
  Suppression,
  TriggeredSendLog,
} from "../domain";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const SECRET = "whsec_" + Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");

function project(id: number, providerId: number | null): Project {
  return { id, userId: "u", name: `p${id}`, providerId, createdAt: new Date(), updatedAt: new Date() } as Project;
}
function provider(id: number, type: EmailProvider["type"], secret?: string): EmailProvider {
  return {
    id, name: "prov", type, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    config: secret === undefined ? {} : { webhook_secret: secret },
  };
}
function campaign(id: number, projectId: number): Campaign {
  return { id, projectId, name: `c${id}`, status: "SENT", type: "CAMPAIGN" } as unknown as Campaign;
}
function log(id: number, campaignId: number, providerMessageId: string, email: string): TriggeredSendLog {
  return { id, campaignId, email, status: "SUCCESS", providerMessageId, data: { x: 1 }, sentAt: new Date() };
}

function fakes() {
  const projects = new Map<number, Project>();
  const providers = new Map<number, EmailProvider>();
  const campaigns = new Map<number, Campaign>();
  const contacts = new Map<number, Contact>();
  const logs: TriggeredSendLog[] = [];
  const suppressions: Suppression[] = [];
  const events: Omit<CampaignEvent, "id" | "occurredAt">[] = [];
  const logUpdates: { id: number; data: Partial<TriggeredSendLog> }[] = [];

  const repos = {
    projects: { findById: async (id: number) => projects.get(id) ?? null },
    providers: { findById: async (id: number) => providers.get(id) ?? null },
    campaigns: {
      findById: async (id: number) => campaigns.get(id) ?? null,
      logEvent: async (data: Omit<CampaignEvent, "id" | "occurredAt">) => {
        events.push(data);
        return { ...data, id: events.length, occurredAt: new Date() } as CampaignEvent;
      },
    },
    contacts: { findById: async (id: number) => contacts.get(id) ?? null },
    sendLogs: {
      findByProviderMessageId: async (mid: string) => logs.find((l) => l.providerMessageId === mid) ?? null,
      findLatestByCampaignAndEmail: async (cid: number, email: string) =>
        logs.find((l) => l.campaignId === cid && l.email === email) ?? null,
      update: async (id: number, data: Partial<TriggeredSendLog>) => {
        logUpdates.push({ id, data });
        return null;
      },
    },
    suppressions: {
      findByProjectAndEmail: async (projectId: number, email: string) =>
        suppressions.find((s) => s.projectId === projectId && s.email === email) ?? null,
      create: async (data: Omit<Suppression, "id" | "createdAt">) => {
        const s = { ...data, id: suppressions.length + 1, createdAt: new Date() };
        suppressions.push(s);
        return s;
      },
    },
  };
  // Only the methods the service calls are faked.
  const service = new WebhookService(repos as never, silent);
  return { service, projects, providers, campaigns, contacts, logs, suppressions, events, logUpdates };
}

function resendBody(type: string, tags: Record<string, string>, to = "bob@example.com", emailId = "msg-1") {
  return JSON.stringify({ type, data: { email_id: emailId, to: [to], tags } });
}
function signResend(body: string, secret = SECRET) {
  const id = "msg_test";
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(id, timestamp, body);
  return {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}
function postmarkBody(RecordType: string, metadata: Record<string, string>, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ RecordType, MessageID: "pm-1", Recipient: "bob@example.com", Metadata: metadata, ...extra });
}

describe("WebhookService.handle - authentication", () => {
  let f: ReturnType<typeof fakes>;
  beforeEach(() => {
    f = fakes();
    f.projects.set(1, project(1, 10));
    f.providers.set(10, provider(10, "RESEND", SECRET));
  });

  it("rejects a body that is not JSON", async () => {
    await expect(f.service.handle("RESEND", "{nope", {})).resolves.toEqual({
      status: "rejected", reason: "invalid_payload",
    });
  });

  it("ignores events without a project tag", async () => {
    const r = await f.service.handle("RESEND", resendBody("email.delivered", {}), {});
    expect(r).toEqual({ status: "ignored", reason: "no_project" });
  });

  it("ignores events for an unknown project", async () => {
    const r = await f.service.handle("RESEND", resendBody("email.delivered", { project_id: "99" }), {});
    expect(r).toEqual({ status: "ignored", reason: "unknown_project" });
  });

  it("ignores events when the project's provider is another type", async () => {
    const r = await f.service.handle("POSTMARK", postmarkBody("Delivery", { project_id: "1" }), {});
    expect(r).toEqual({ status: "ignored", reason: "provider_mismatch" });
  });

  it("rejects everything when no secret is configured", async () => {
    f.providers.set(10, provider(10, "RESEND"));
    const body = resendBody("email.delivered", { project_id: "1" });
    const r = await f.service.handle("RESEND", body, signResend(body));
    expect(r).toEqual({ status: "rejected", reason: "secret_not_configured" });
  });

  it("rejects a bad svix signature", async () => {
    const body = resendBody("email.delivered", { project_id: "1" });
    const other = "whsec_" + Buffer.from("ffffffffffffffffffffffffffffffff").toString("base64");
    const r = await f.service.handle("RESEND", body, signResend(body, other));
    expect(r).toEqual({ status: "rejected", reason: "invalid_signature" });
    expect(f.events).toHaveLength(0);
  });

  it("accepts a good svix signature whatever the header case", async () => {
    const body = resendBody("email.delivered", { project_id: "1" });
    const h = signResend(body);
    const upper = { "Svix-Id": h["svix-id"], "Svix-Timestamp": h["svix-timestamp"], "Svix-Signature": h["svix-signature"] };
    const r = await f.service.handle("RESEND", body, upper);
    expect(r.status).toBe("processed");
  });

  it("checks the Postmark shared secret", async () => {
    f.projects.set(2, project(2, 20));
    f.providers.set(20, provider(20, "POSTMARK", "s3cret"));
    const body = postmarkBody("Delivery", { project_id: "2" });
    expect((await f.service.handle("POSTMARK", body, {})).status).toBe("rejected");
    expect((await f.service.handle("POSTMARK", body, { [POSTMARK_SECRET_HEADER]: "wrong" })).status).toBe("rejected");
    expect((await f.service.handle("POSTMARK", body, { [POSTMARK_SECRET_HEADER]: "s3cret" })).status).toBe("processed");
  });
});

describe("WebhookService - applying events", () => {
  let f: ReturnType<typeof fakes>;
  const headers = { [POSTMARK_SECRET_HEADER]: "s3cret" };
  beforeEach(() => {
    f = fakes();
    f.projects.set(1, project(1, 10));
    f.providers.set(10, provider(10, "POSTMARK", "s3cret"));
    f.campaigns.set(100, campaign(100, 1));
    f.campaigns.set(200, campaign(200, 2)); // another tenant
  });

  it("marks the send log, logs the campaign event and suppresses on a bounce", async () => {
    f.logs.push(log(5, 100, "pm-1", "bob@example.com"));
    const r = await f.service.handle("POSTMARK", postmarkBody("Bounce", { project_id: "1", campaign_id: "100" }), headers);
    expect(r.status).toBe("processed");
    expect(f.logUpdates).toEqual([
      { id: 5, data: { status: "BOUNCED", data: { x: 1, postmark_event: expect.any(Object) } } },
    ]);
    expect(f.events).toMatchObject([{ campaignId: 100, email: "bob@example.com", type: "BOUNCE" }]);
    expect(f.suppressions).toMatchObject([{ projectId: 1, email: "bob@example.com", reason: "BOUNCE" }]);
  });

  it("maps a complaint to SPAM_REPORT / SPAM and a delivery to DELIVERED without suppressing", async () => {
    await f.service.handle("POSTMARK", postmarkBody("SpamComplaint", { project_id: "1", campaign_id: "100" }), headers);
    await f.service.handle("POSTMARK", postmarkBody("Delivery", { project_id: "1", campaign_id: "100" }), headers);
    expect(f.events.map((e) => e.type)).toEqual(["SPAM_REPORT", "DELIVERED"]);
    expect(f.suppressions).toMatchObject([{ reason: "SPAM" }]);
  });

  it("suppresses an address once across repeated bounces", async () => {
    const body = postmarkBody("Bounce", { project_id: "1", campaign_id: "100" });
    await f.service.handle("POSTMARK", body, headers);
    await f.service.handle("POSTMARK", body, headers);
    expect(f.suppressions).toHaveLength(1);
  });

  it("drops a campaign id that belongs to another project", async () => {
    const r = await f.service.handle("POSTMARK", postmarkBody("Bounce", { project_id: "1", campaign_id: "200" }), headers);
    expect(r.status).toBe("processed");
    expect(f.events).toHaveLength(0);
    // The address is still suppressed in the project that was authenticated.
    expect(f.suppressions).toMatchObject([{ projectId: 1 }]);
  });

  it("drops a send log whose campaign is in another project", async () => {
    f.logs.push(log(7, 200, "pm-1", "bob@example.com"));
    await f.service.handle("POSTMARK", postmarkBody("Delivery", { project_id: "1" }), headers);
    expect(f.logUpdates).toHaveLength(0);
    expect(f.events).toHaveLength(0);
  });

  it("finds the campaign through the send log when the event has no campaign tag", async () => {
    f.logs.push(log(8, 100, "pm-1", "bob@example.com"));
    await f.service.handle("POSTMARK", postmarkBody("Delivery", { project_id: "1" }), headers);
    expect(f.logUpdates).toMatchObject([{ id: 8, data: { status: "DELIVERED" } }]);
    expect(f.events).toMatchObject([{ campaignId: 100 }]);
  });

  it("falls back to the latest log of the campaign for that address", async () => {
    f.logs.push(log(9, 100, "other-id", "bob@example.com"));
    await f.service.handle("POSTMARK", postmarkBody("Delivery", { project_id: "1", campaign_id: "100" }), headers);
    expect(f.logUpdates).toMatchObject([{ id: 9 }]);
  });

  it("keeps the contact id only when the contact is in the project", async () => {
    f.contacts.set(1, { id: 1, projectId: 1, email: "bob@example.com" } as Contact);
    f.contacts.set(2, { id: 2, projectId: 2, email: "bob@example.com" } as Contact);
    await f.service.handle("POSTMARK", postmarkBody("Delivery", { project_id: "1", campaign_id: "100", contact_id: "1" }), headers);
    await f.service.handle("POSTMARK", postmarkBody("Delivery", { project_id: "1", campaign_id: "100", contact_id: "2" }), headers);
    await f.service.handle("POSTMARK", postmarkBody("Delivery", { project_id: "1", campaign_id: "100", contact_id: "0" }), headers);
    expect(f.events.map((e) => e.contactId)).toEqual([1, null, null]);
  });

  it("records Postmark opens and clicks with the link", async () => {
    await f.service.handle("POSTMARK", postmarkBody("Open", { project_id: "1", campaign_id: "100" }), headers);
    await f.service.handle("POSTMARK", postmarkBody("Click", { project_id: "1", campaign_id: "100" }, { OriginalLink: "https://x.test/a" }), headers);
    expect(f.events).toMatchObject([
      { type: "OPEN" },
      { type: "CLICK", metadata: { url: "https://x.test/a" } },
    ]);
    expect(f.suppressions).toHaveLength(0);
  });

  it("ignores record types Senlo does not track and incomplete payloads", async () => {
    const r1 = await f.service.handle("POSTMARK", postmarkBody("SubscriptionChange", { project_id: "1" }), headers);
    const r2 = await f.service.handle(
      "POSTMARK",
      JSON.stringify({ RecordType: "Delivery", Metadata: { project_id: "1" } }),
      headers,
    );
    expect(r1).toEqual({ status: "ignored", reason: "untracked_event" });
    expect(r2).toEqual({ status: "ignored", reason: "untracked_event" });
  });

  it("does not count Resend opens and clicks (Senlo tracks them itself)", async () => {
    f.providers.set(10, provider(10, "RESEND", SECRET));
    const body = resendBody("email.opened", { project_id: "1", campaign_id: "100" });
    const r = await f.service.handle("RESEND", body, signResend(body));
    expect(r).toEqual({ status: "ignored", reason: "untracked_event" });
  });

  it("stores the Resend payload under resend_event", async () => {
    f.providers.set(10, provider(10, "RESEND", SECRET));
    f.logs.push(log(5, 100, "msg-1", "bob@example.com"));
    const body = resendBody("email.complained", { project_id: "1" });
    await f.service.handle("RESEND", body, signResend(body));
    expect(f.logUpdates[0].data).toMatchObject({ status: "COMPLAINED", data: { resend_event: { type: "email.complained" } } });
    expect(f.events[0].metadata).toHaveProperty("resend_event");
  });
});

describe("readResendTags", () => {
  it("reads both tag shapes", () => {
    expect(readResendTags({ tags: [{ name: "project_id", value: 1 }, { bad: true }] })).toEqual({ project_id: "1" });
    expect(readResendTags({ tags: { project_id: "2", campaign_id: 3 } })).toEqual({ project_id: "2", campaign_id: "3" });
    expect(readResendTags({})).toEqual({});
    expect(readResendTags("x")).toEqual({});
  });
});
