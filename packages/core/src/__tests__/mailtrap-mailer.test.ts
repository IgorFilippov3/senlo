// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MailtrapMailer, parseMailtrapAddress } from "../services/mail/mailtrapMailer";
import { MailerFactory } from "../services/mail";
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

const options: SendMailOptions = {
  from: '"Senlo Team" <hi@senlo.io>',
  to: "bob@example.com",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
  replyTo: "Help <help@senlo.io>",
  tags: { project_id: "1", campaign_id: "100", contact_id: "7" },
  headers: {
    "List-Unsubscribe": "<https://senlo.io/api/unsubscribe/t>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
};

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("parseMailtrapAddress", () => {
  it("reads a bare address, a named one and a quoted name", () => {
    expect(parseMailtrapAddress(" bob@example.com ")).toEqual({ email: "bob@example.com" });
    expect(parseMailtrapAddress("Bob <bob@example.com>")).toEqual({ email: "bob@example.com", name: "Bob" });
    expect(parseMailtrapAddress('"Bob B." <bob@example.com>')).toEqual({ email: "bob@example.com", name: "Bob B." });
    expect(parseMailtrapAddress("<bob@example.com>")).toEqual({ email: "bob@example.com" });
  });
});

describe("MailtrapMailer.send", () => {
  it("posts to the transactional stream with the token, addresses as objects and tags as custom variables", async () => {
    answer(200, { success: true, message_ids: ["0c7fd939-02cf-11ed-88c2-0a58a9feac02"] });

    expect(await new MailtrapMailer("mt_token").send(options)).toEqual({
      success: true,
      messageId: "0c7fd939-02cf-11ed-88c2-0a58a9feac02",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://send.api.mailtrap.io/api/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer mt_token",
      "Content-Type": "application/json",
    });
    expect(sentBody()).toEqual({
      from: { email: "hi@senlo.io", name: "Senlo Team" },
      to: [{ email: "bob@example.com" }],
      reply_to: { email: "help@senlo.io", name: "Help" },
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      headers: options.headers,
      custom_variables: { project_id: "1", campaign_id: "100", contact_id: "7" },
    });
  });

  it("leaves out what is not set", async () => {
    answer(200, { success: true, message_ids: ["id"] });

    await new MailtrapMailer("mt_token").send({ from: "hi@senlo.io", to: "bob@example.com", subject: "S", html: "<p>x</p>", text: "" });

    const body = sentBody();
    expect(body).not.toHaveProperty("reply_to");
    expect(body).not.toHaveProperty("text");
    expect(body).not.toHaveProperty("headers");
    expect(body).not.toHaveProperty("custom_variables");
  });

  it("joins the errors of a refused request and does not throw", async () => {
    answer(401, { success: false, errors: ["Unauthorized"] });
    expect(await new MailtrapMailer("bad").send(options)).toEqual({
      success: false,
      error: "Unauthorized",
      permanent: true,
    });

    answer(400, { success: false, errors: ["'from' address is invalid", "'subject' is missing"] });
    expect(await new MailtrapMailer("mt_token").send(options)).toEqual({
      success: false,
      error: "'from' address is invalid; 'subject' is missing",
      permanent: true,
    });
  });

  it("lets a retry happen after a server error or a rate limit", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await new MailtrapMailer("mt_token").send(options)).toEqual({
      success: false,
      error: "Mailtrap API error (status 502)",
      permanent: false,
    });

    answer(429, { success: false, errors: ["Rate limit exceeded"] });
    expect(await new MailtrapMailer("mt_token").send(options)).toMatchObject({ success: false, permanent: false });
  });

  it("turns a network failure into a failed send", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await new MailtrapMailer("mt_token").send(options)).toEqual({ success: false, error: "fetch failed" });
  });
});

describe("MailtrapMailer.verify", () => {
  // As Mailtrap answered for a token scoped to one sending domain.
  const domainToken = [
    { id: 1978913, name: "Campaigns", access_level: 100, type: "email_campaign_permission_scope", resources: [] },
    { id: 232829, name: "demomailtrap.com", access_level: 100, type: "domain", resources: [] },
  ];

  it("a token that reaches a sending domain is valid", async () => {
    answer(200, domainToken);
    expect(await new MailtrapMailer("mt_token").verify()).toEqual({ status: "valid" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mailtrap.io/api/permissions/resources");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ Authorization: "Bearer mt_token" });
  });

  it("finds a domain nested in the tree", async () => {
    answer(200, [{ type: "account", resources: [{ type: "sending_domain", resources: [] }] }]);
    expect((await new MailtrapMailer("mt_token").verify()).status).toBe("valid");
  });

  it("warns, without refusing, when no sending domain is listed", async () => {
    answer(200, [{ type: "project", resources: [{ type: "sandbox", resources: [] }] }]);
    expect(await new MailtrapMailer("mt_token").verify()).toMatchObject({
      status: "unknown",
      message: expect.stringContaining("no sending domain"),
    });
  });

  it("a wrong token is invalid", async () => {
    answer(401, { error: "Incorrect API token" });
    expect(await new MailtrapMailer("bad").verify()).toEqual({
      status: "invalid",
      message: "Mailtrap rejected the API token: Incorrect API token",
    });
  });

  it("a token without permission to read resources is limited, not invalid", async () => {
    answer(403, { errors: "Access forbidden" });
    expect((await new MailtrapMailer("mt_token").verify()).status).toBe("limited");
  });

  it("a server error or a network failure is unknown", async () => {
    answer(500, {});
    expect((await new MailtrapMailer("mt_token").verify()).status).toBe("unknown");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await new MailtrapMailer("mt_token").verify()).status).toBe("unknown");
  });
});

describe("MailerFactory MAILTRAP", () => {
  const provider = (config: Record<string, string>) =>
    ({ id: 1, name: "m", type: "MAILTRAP", isActive: true, config, createdAt: new Date(), updatedAt: new Date() }) as never;

  it("builds the mailer from the stored token and refuses a config without one", () => {
    expect(MailerFactory.create(provider({ apiKey: "mt_token" }))).toBeInstanceOf(MailtrapMailer);
    expect(() => MailerFactory.create(provider({}))).toThrow("Mailtrap API token is missing");
  });
});
