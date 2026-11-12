import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { WebhookService } from "../services/webhook/webhookService";
import { createSesWebhookAdapter } from "../services/webhook/ses";
import { snsStringToSign, type SnsEnvelope } from "../services/webhook/sns";
import type { Logger } from "../logger";
import type { CampaignEvent, EmailProvider, Project, Suppression, TriggeredSendLog } from "../domain";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

// Throwaway openssl key and certificate, see sns.test.ts.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/sns/${name}`, import.meta.url), "utf8");
const KEY = fixture("test-only-signing-key.pem");
const CERT = fixture("test-only-signing-cert.pem");

const REGION = "eu-west-1";
const CERT_URL = `https://sns.${REGION}.amazonaws.com/SimpleNotificationService-abc.pem`;
const TOPIC = `arn:aws:sns:${REGION}:123456789012:senlo-events`;
const OTHER_TOPIC = `arn:aws:sns:${REGION}:999999999999:attacker`;
const subscribeUrl = (topic = TOPIC, region = REGION) =>
  `https://sns.${region}.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${encodeURIComponent(topic)}&Token=t0k`;

function sign(fields: Omit<SnsEnvelope, "Signature">): string {
  const unsigned = { ...fields, Signature: "" } as SnsEnvelope;
  const Signature = createSign("RSA-SHA256").update(snsStringToSign(unsigned), "utf8").sign(KEY, "base64");
  return JSON.stringify({ ...unsigned, Signature });
}

const base = { TopicArn: TOPIC, Timestamp: "2026-11-12T10:00:00.000Z", SignatureVersion: "2" as const, SigningCertURL: CERT_URL };

function notification(sesEvent: Record<string, unknown>, overrides: Partial<SnsEnvelope> = {}): string {
  return sign({ ...base, Type: "Notification", MessageId: "n-1", Message: JSON.stringify(sesEvent), ...overrides });
}

function confirmation(overrides: Partial<SnsEnvelope> = {}): string {
  return sign({
    ...base,
    Type: "SubscriptionConfirmation",
    MessageId: "c-1",
    Message: "You have chosen to subscribe to the topic",
    SubscribeURL: subscribeUrl(overrides.TopicArn ?? TOPIC),
    Token: "t0k",
    ...overrides,
  });
}

function sesEvent(eventType: string, detail: Record<string, unknown> = {}, tags: Record<string, string[]> = { project_id: ["1"], campaign_id: ["100"] }) {
  return {
    eventType,
    mail: { messageId: "ses-msg-1", destination: ["bob@example.com"], tags },
    ...detail,
  };
}

const bounce = (bounceType: string, email = "bob@example.com") =>
  sesEvent("Bounce", { bounce: { bounceType, bouncedRecipients: [{ emailAddress: email }] } });

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

  const fetched: string[] = [];
  const fetch = vi.fn(async (url: string) => {
    fetched.push(url);
    return url === CERT_URL ? CERT : "<ConfirmSubscriptionResponse/>";
  });
  const adapter = createSesWebhookAdapter({ fetch });
  const service = new WebhookService(repos as never, silent, [adapter]);
  return { service, projects, providers, logs, suppressions, events, logUpdates, fetched, fetch };
}

function sesProvider(id: number, topic?: string): EmailProvider {
  return {
    id, name: "ses", type: "SES", isActive: true, createdAt: new Date(), updatedAt: new Date(),
    config: { accessKeyId: "AKIA", secretAccessKey: "s", region: REGION, ...(topic === undefined ? {} : { webhook_secret: topic }) },
  };
}

const q = (provider: number | string = 10) => ({ provider: String(provider) });

describe("SES webhook via SNS", () => {
  let f: ReturnType<typeof fakes>;

  beforeEach(() => {
    f = fakes();
    f.projects.set(1, { id: 1, providerId: 10 } as Project);
    f.projects.set(2, { id: 2, providerId: 20 } as Project);
    f.providers.set(10, sesProvider(10, TOPIC));
    f.providers.set(20, sesProvider(20, OTHER_TOPIC));
  });

  describe("subscription handshake", () => {
    it("confirms a signed confirmation from the configured topic", async () => {
      const r = await f.service.handle("SES", confirmation(), {}, q());
      expect(r).toEqual({ status: "ignored", reason: "subscription_confirmed" });
      expect(f.fetched).toEqual([CERT_URL, subscribeUrl()]);
    });

    it("does not confirm another topic, and fetches nothing for it", async () => {
      const r = await f.service.handle("SES", confirmation({ TopicArn: OTHER_TOPIC }), {}, q());
      expect(r).toEqual({ status: "rejected", reason: "invalid_signature" });
      expect(f.fetch).not.toHaveBeenCalled();
    });

    it("does not confirm when the signature does not match", async () => {
      const body = JSON.parse(confirmation());
      body.SubscribeURL = subscribeUrl(TOPIC) + "&x=1";
      const r = await f.service.handle("SES", JSON.stringify(body), {}, q());
      expect(r.status).toBe("rejected");
      expect(f.fetched).toEqual([CERT_URL]);
    });

    it("never GETs a SubscribeURL outside the topic's SNS region", async () => {
      const body = confirmation({ SubscribeURL: subscribeUrl(TOPIC, "us-east-1") });
      await expect(f.service.handle("SES", body, {}, q())).rejects.toThrow(/SubscribeURL/);
      expect(f.fetched).toEqual([CERT_URL]);
    });

    it("never GETs a SubscribeURL on another host", async () => {
      const body = confirmation({ SubscribeURL: "https://attacker.s3.amazonaws.com/?Action=ConfirmSubscription" });
      await expect(f.service.handle("SES", body, {}, q())).rejects.toThrow();
      expect(f.fetched).toEqual([CERT_URL]);
    });

    it("answers an unsubscribe confirmation without re-subscribing", async () => {
      const r = await f.service.handle("SES", confirmation({ Type: "UnsubscribeConfirmation" }), {}, q());
      expect(r).toEqual({ status: "ignored", reason: "subscription_confirmed" });
      expect(f.fetched).toEqual([CERT_URL]);
    });
  });

  describe("provider binding", () => {
    it("ignores a callback without a provider id or with an unknown one", async () => {
      expect(await f.service.handle("SES", confirmation(), {}, {})).toEqual({ status: "ignored", reason: "no_provider" });
      expect(await f.service.handle("SES", confirmation(), {}, q(99))).toEqual({ status: "ignored", reason: "unknown_provider" });
      expect(await f.service.handle("SES", confirmation(), {}, q("abc"))).toEqual({ status: "ignored", reason: "no_provider" });
    });

    it("ignores a provider of another type", async () => {
      f.providers.set(30, { ...sesProvider(30, TOPIC), type: "SENDGRID" });
      expect(await f.service.handle("SES", confirmation(), {}, q(30))).toEqual({ status: "ignored", reason: "unknown_provider" });
    });

    it("refuses everything when no topic ARN is configured", async () => {
      f.providers.set(10, sesProvider(10));
      expect(await f.service.handle("SES", notification(bounce("Permanent")), {}, q())).toEqual({
        status: "rejected", reason: "secret_not_configured",
      });
      expect(f.fetch).not.toHaveBeenCalled();
    });

    it("drops an event whose project does not use this provider", async () => {
      const body = notification(sesEvent("Bounce", { bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "x@y.z" }] } }, { project_id: ["2"] }));
      expect(await f.service.handle("SES", body, {}, q())).toEqual({ status: "ignored", reason: "provider_mismatch" });
      expect(f.suppressions).toHaveLength(0);
    });

    it("drops an event without a project tag", async () => {
      const body = notification(sesEvent("Delivery", {}, {}));
      expect(await f.service.handle("SES", body, {}, q())).toEqual({ status: "ignored", reason: "no_project" });
    });

    it("rejects a body that is not an SNS envelope", async () => {
      expect((await f.service.handle("SES", JSON.stringify({ hello: 1 }), {}, q())).status).toBe("rejected");
      expect((await f.service.handle("SES", "not json", {}, q())).status).toBe("rejected");
    });
  });

  describe("events", () => {
    it("marks a delivery and matches the log by the SES message id", async () => {
      f.logs.push({ id: 5, campaignId: 100, email: "bob@example.com", status: "SUCCESS", providerMessageId: "ses-msg-1", data: {}, sentAt: new Date() });
      const body = notification(sesEvent("Delivery", { delivery: { recipients: ["bob@example.com"] } }));
      const r = await f.service.handle("SES", body, {}, q());
      expect(r).toMatchObject({ status: "processed", event: { type: "DELIVERED", providerMessageId: "ses-msg-1", campaignId: 100 } });
      expect(f.logUpdates[0]).toMatchObject({ id: 5, data: { status: "DELIVERED" } });
      expect(f.events[0].metadata).toHaveProperty("ses_event");
      expect(f.suppressions).toHaveLength(0);
    });

    it("suppresses a permanent bounce, not a transient or undetermined one", async () => {
      await f.service.handle("SES", notification(bounce("Permanent", "hard@example.com")), {}, q());
      await f.service.handle("SES", notification(bounce("Transient", "soft@example.com")), {}, q());
      await f.service.handle("SES", notification(bounce("Undetermined", "maybe@example.com")), {}, q());
      expect(f.suppressions.map((s) => [s.email, s.reason])).toEqual([["hard@example.com", "BOUNCE"]]);
    });

    it("suppresses a complaint unless the feedback says not-spam", async () => {
      const complaint = (email: string, extra: Record<string, unknown> = {}) =>
        notification(sesEvent("Complaint", { complaint: { complainedRecipients: [{ emailAddress: email }], ...extra } }));
      await f.service.handle("SES", complaint("spam@example.com", { complaintFeedbackType: "abuse" }), {}, q());
      await f.service.handle("SES", complaint("nofeedback@example.com"), {}, q());
      await f.service.handle("SES", complaint("ok@example.com", { complaintFeedbackType: "not-spam" }), {}, q());
      expect(f.suppressions.map((s) => [s.email, s.reason])).toEqual([
        ["spam@example.com", "SPAM"],
        ["nofeedback@example.com", "SPAM"],
      ]);
    });

    it.each(["Send", "Reject", "Open", "Click", "RenderingFailure", "DeliveryDelay", "Subscription"])(
      "ignores %s",
      async (type) => {
        const r = await f.service.handle("SES", notification(sesEvent(type)), {}, q());
        expect(r).toEqual({ status: "ignored", reason: "untracked_event" });
      },
    );

    it("falls back to mail.destination for the recipient", async () => {
      const r = await f.service.handle("SES", notification(sesEvent("Delivery")), {}, q());
      expect(r).toMatchObject({ status: "processed", event: { email: "bob@example.com" } });
    });

    it("rejects an event whose message was changed after signing", async () => {
      const body = JSON.parse(notification(bounce("Transient")));
      body.Message = JSON.stringify(bounce("Permanent", "victim@example.com"));
      expect(await f.service.handle("SES", JSON.stringify(body), {}, q())).toEqual({
        status: "rejected", reason: "invalid_signature",
      });
      expect(f.suppressions).toHaveLength(0);
    });

    it("rejects an AWS-signed event from another topic, without fetching anything", async () => {
      const body = notification(bounce("Permanent", "victim@example.com"), { TopicArn: OTHER_TOPIC });
      expect(await f.service.handle("SES", body, {}, q())).toEqual({ status: "rejected", reason: "invalid_signature" });
      expect(f.fetch).not.toHaveBeenCalled();
      expect(f.suppressions).toHaveLength(0);
    });
  });
});
