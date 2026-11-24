import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SparkPostMailer } from "../services/mail/sparkpostMailer";
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

const mail: SendMailOptions = {
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

describe("SparkPostMailer.send", () => {
  it("posts to US transmissions endpoint by default with Authorization header, content, and metadata", async () => {
    answer(200, {
      results: { id: "11552828236711111", total_accepted_recipients: 1, total_rejected_recipients: 0 },
    });

    const result = await new SparkPostMailer({ apiKey: "sp_test_key" }).send(mail);
    expect(result).toEqual({ success: true, messageId: "11552828236711111" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sparkpost.com/api/v1/transmissions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "sp_test_key",
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      recipients: [{ address: "bob@example.com" }],
      content: {
        from: "Senlo <hi@senlo.io>",
        subject: "Hello",
        html: "<p>Hi</p>",
        text: "Hi",
        reply_to: "help@senlo.io",
        headers: mail.headers,
      },
      metadata: { project_id: "1", campaign_id: "100", contact_id: "7" },
      options: { open_tracking: false, click_tracking: false },
    });
  });

  it("uses api.eu.sparkpost.com when region is EU", async () => {
    answer(200, { results: { id: "eu_tx_1" } });

    const result = await new SparkPostMailer({ apiKey: "sp_eu_key", region: "EU" }).send(mail);
    expect(result).toEqual({ success: true, messageId: "eu_tx_1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.eu.sparkpost.com/api/v1/transmissions");
  });

  it("returns SparkPost API error message and marks 4xx as permanent", async () => {
    answer(400, {
      errors: [{ message: "Invalid domain", description: "Unconfigured or unverified sending domain", code: "1902" }],
    });

    expect(await new SparkPostMailer({ apiKey: "sp_test_key" }).send(mail)).toEqual({
      success: false,
      error: "Unconfigured or unverified sending domain",
      permanent: true,
    });
  });

  it("marks 429 and 5xx as non-permanent and never throws on network error", async () => {
    answer(429, { errors: [{ message: "Too many requests" }] });
    expect(await new SparkPostMailer({ apiKey: "sp_test_key" }).send(mail)).toEqual({
      success: false,
      error: "Too many requests",
      permanent: false,
    });

    answer(503, {});
    expect(await new SparkPostMailer({ apiKey: "sp_test_key" }).send(mail)).toEqual({
      success: false,
      error: "SparkPost API error (status 503)",
      permanent: false,
    });

    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await new SparkPostMailer({ apiKey: "sp_test_key" }).send(mail)).toEqual({
      success: false,
      error: "network down",
    });
  });
});

describe("SparkPostMailer.verify", () => {
  it("checks sending-domains on the configured region", async () => {
    answer(200, { results: [] });
    expect(await new SparkPostMailer({ apiKey: "sp_eu_key", region: "EU" }).verify()).toEqual({ status: "valid" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.eu.sparkpost.com/api/v1/sending-domains");
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: "sp_eu_key" });

    answer(401, { errors: [{ message: "Unauthorized." }] });
    expect(await new SparkPostMailer({ apiKey: "bad" }).verify()).toEqual({
      status: "invalid",
      message: "SparkPost rejected the credentials: Unauthorized.",
    });
  });
});
