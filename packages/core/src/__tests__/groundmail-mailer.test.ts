import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GroundmailMailer, groundmailCategory } from "../services/mail/groundmailMailer";
import type { SendMailOptions } from "../ports";

const fetchMock = vi.fn();
const answer = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const campaign: SendMailOptions = {
  from: "Senlo <hi@senlo.io>",
  to: "bob@example.com",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
  replyTo: "help@senlo.io",
  tags: { project_id: "1", campaign_id: "100", contact_id: "7" },
  headers: {
    "List-Unsubscribe": "<https://senlo.io/api/unsubscribe/t>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
};

const triggered: SendMailOptions = {
  from: "hi@senlo.io",
  to: "bob@example.com",
  subject: "Your code",
  html: "<p>123456</p>",
  tags: { project_id: "1", campaign_id: "0", contact_id: "0" },
};

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("GroundmailMailer.send", () => {
  it("posts a campaign as product email and keeps Senlo's unsubscribe headers", async () => {
    answer(200, { id: "msg_123", status: "queued" });

    expect(await new GroundmailMailer("gm_key").send(campaign)).toEqual({ success: true, messageId: "msg_123" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groundmail.dev/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer gm_key", "Content-Type": "application/json" });
    expect(sentBody()).toEqual({
      from: "Senlo <hi@senlo.io>",
      to: "bob@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      reply_to: "help@senlo.io",
      headers: campaign.headers,
      tags: { project_id: "1", campaign_id: "100", contact_id: "7" },
      category: "product",
      unsubscribe: false,
    });
  });

  it("sends a triggered email as transactional, without touching unsubscribe", async () => {
    answer(200, { id: "msg_456", status: "queued" });

    expect(await new GroundmailMailer("gm_key").send(triggered)).toEqual({ success: true, messageId: "msg_456" });
    expect(sentBody()).toMatchObject({ category: "transactional" });
    expect(sentBody()).not.toHaveProperty("unsubscribe");
  });

  it("a campaign without a List-Unsubscribe header leaves unsubscribe to Groundmail", async () => {
    answer(200, { id: "msg_789", status: "queued" });

    await new GroundmailMailer("gm_key").send({ ...campaign, headers: undefined });
    expect(sentBody()).toMatchObject({ category: "product" });
    expect(sentBody()).not.toHaveProperty("unsubscribe");
  });

  it("returns a refused send as a permanent failure with the API's message and code", async () => {
    answer(422, { error: { message: "The from domain is not verified", code: "domain_not_verified" } });

    expect(await new GroundmailMailer("gm_key").send(triggered)).toEqual({
      success: false,
      error: "The from domain is not verified (domain_not_verified)",
      permanent: true,
    });
  });

  it("a rate limit or a server error is not permanent, so the queue retries", async () => {
    answer(429, { error: { message: "Too many requests", code: "rate_limited" } });
    expect(await new GroundmailMailer("gm_key").send(triggered)).toMatchObject({ success: false, permanent: false });

    answer(503, {});
    expect(await new GroundmailMailer("gm_key").send(triggered)).toEqual({
      success: false,
      error: "Groundmail API error (status 503)",
      permanent: false,
    });
  });

  it("never throws on a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));
    expect(await new GroundmailMailer("gm_key").send(triggered)).toEqual({ success: false, error: "fetch failed" });
  });
});

describe("GroundmailMailer.verify", () => {
  it("a key that reads domains is valid", async () => {
    answer(200, { data: [] });
    expect((await new GroundmailMailer("gm_key").verify()).status).toBe("valid");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groundmail.dev/domains");
  });

  it("a sending-only key is limited, not invalid", async () => {
    answer(403, { error: { message: "This key cannot read domains", code: "insufficient_scope" } });
    expect((await new GroundmailMailer("gm_key").verify()).status).toBe("limited");
  });

  it("a wrong key is invalid", async () => {
    answer(401, { error: { message: "Invalid API key", code: "unauthorized" } });
    expect(await new GroundmailMailer("gm_bad").verify()).toEqual({
      status: "invalid",
      message: "Groundmail rejected the credentials: Invalid API key",
    });
  });
});

describe("groundmailCategory", () => {
  it("a campaign is product email, everything else transactional", () => {
    expect(groundmailCategory(campaign)).toBe("product");
    expect(groundmailCategory(triggered)).toBe("transactional");
    expect(groundmailCategory({ ...triggered, tags: undefined })).toBe("transactional");
  });
});
