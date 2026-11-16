import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GROUNDMAIL_SIGNATURE_HEADER,
  groundmailWebhookAdapter as adapter,
  parseGroundmailSignature,
  readGroundmailTags,
} from "../services/webhook/groundmail";

const SECRET = "whsec_test_secret";

/** Signs the way Groundmail does: hex HMAC-SHA256 of "<t>.<raw body>". */
function sign(body: string, t = Math.floor(Date.now() / 1000), secret = SECRET) {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return { [GROUNDMAIL_SIGNATURE_HEADER]: `t=${t},v1=${v1}` };
}

function event(type: string, data: Record<string, unknown> = {}) {
  return {
    type,
    created_at: "2026-11-16T12:00:00.000Z",
    data: {
      email_id: "msg_1",
      to: ["bob@example.com"],
      tags: [
        { name: "project_id", value: "1" },
        { name: "campaign_id", value: "100" },
        { name: "contact_id", value: "7" },
      ],
      ...data,
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("groundmailWebhookAdapter.verify", () => {
  const body = JSON.stringify(event("email.delivered"));

  it("accepts a body signed with the secret", async () => {
    expect(await adapter.verify(body, sign(body), SECRET)).toEqual(JSON.parse(body));
  });

  it("refuses a wrong secret, an edited body or a missing header", async () => {
    expect(await adapter.verify(body, sign(body, undefined, "whsec_other"), SECRET)).toBeNull();
    expect(await adapter.verify(body.replace("msg_1", "msg_2"), sign(body), SECRET)).toBeNull();
    expect(await adapter.verify(body, {}, SECRET)).toBeNull();
    expect(await adapter.verify(body, { [GROUNDMAIL_SIGNATURE_HEADER]: "t=abc,v1=zz" }, SECRET)).toBeNull();
  });

  it("refuses a signature more than 5 minutes old or ahead", async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await adapter.verify(body, sign(body, now - 301), SECRET)).toBeNull();
    expect(await adapter.verify(body, sign(body, now + 301), SECRET)).toBeNull();
    expect(await adapter.verify(body, sign(body, now - 299), SECRET)).not.toBeNull();
  });
});

describe("groundmailWebhookAdapter.normalize", () => {
  it("maps delivered, bounced and complained events with the tags sent", () => {
    expect(adapter.normalize(event("email.delivered"))).toMatchObject({
      provider: "GROUNDMAIL",
      type: "DELIVERED",
      providerMessageId: "msg_1",
      email: "bob@example.com",
      campaignId: 100,
      contactId: 7,
    });
    expect(adapter.normalize(event("email.bounced", { bounce_type: "hard" }))?.type).toBe("BOUNCE");
    expect(adapter.normalize(event("email.complained"))?.type).toBe("SPAM_REPORT");
  });

  it("an unknown bounce type counts as hard; a block bounce is not the address's fault", () => {
    expect(adapter.normalize(event("email.bounced", { bounce_type: "soft" }))?.type).toBe("BOUNCE");
    expect(adapter.normalize(event("email.bounced", { bounce_type: "block" }))).toBeNull();
  });

  it("a failed send counts only when it is a hard failure to the address", () => {
    expect(adapter.normalize(event("email.failed", { bounce_type: "hard" }))?.type).toBe("BOUNCE");
    expect(adapter.normalize(event("email.failed", { bounce_type: null }))).toBeNull();
  });

  it("ignores opens, clicks and other events, and incomplete payloads", () => {
    expect(adapter.normalize(event("email.opened"))).toBeNull();
    expect(adapter.normalize(event("email.clicked"))).toBeNull();
    expect(adapter.normalize(event("email.sent"))).toBeNull();
    expect(adapter.normalize(event("email.delivered", { email_id: undefined }))).toBeNull();
    expect(adapter.normalize(event("email.delivered", { to: [] }))).toBeNull();
    expect(adapter.normalize("nope")).toBeNull();
  });
});

describe("readProjectId and tags", () => {
  it("reads the project from the tags, as pairs or as an object", () => {
    expect(adapter.readProjectId(event("email.delivered"))).toBe(1);
    expect(adapter.readProjectId(event("email.delivered", { tags: { project_id: "3" } }))).toBe(3);
    expect(adapter.readProjectId(event("email.delivered", { tags: [] }))).toBeNull();
    expect(readGroundmailTags({ tags: [{ name: "a", value: 1 }] })).toEqual({ a: "1" });
  });

  it("parses the signature header", () => {
    expect(parseGroundmailSignature("t=1721908800,v1=ABC123")).toEqual({ timestamp: 1721908800, signature: "abc123" });
    expect(parseGroundmailSignature("v1=abc")).toBeNull();
    expect(parseGroundmailSignature(undefined)).toBeNull();
  });
});
