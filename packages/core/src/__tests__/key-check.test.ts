// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ResendMailer } from "../services/mail/resendMailer";
import { SendGridMailer } from "../services/mail/sendgridMailer";
import { MailgunMailer } from "../services/mail/mailgunMailer";
import { PostmarkMailer } from "../services/mail/postmarkMailer";
import { EmailProviderService } from "../services/emailProviderService";
import { FormValidationError } from "../errors";
import type { EmailProvider, KeyCheck } from "../index";

const fetchMock = vi.fn();
const answer = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("verify(): what each provider's answer means", () => {
  it("Resend: a full key is valid, a sending-only key is limited, a wrong key is invalid", async () => {
    answer(200, { data: [] });
    expect((await new ResendMailer("re_1").verify()).status).toBe("valid");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.resend.com/domains");
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer re_1", "User-Agent": "Senlo" });

    answer(401, { name: "restricted_api_key", message: "This API key is restricted to only send emails" });
    expect((await new ResendMailer("re_1").verify()).status).toBe("limited");

    answer(403, { name: "invalid_api_key", message: "API key is invalid" });
    expect(await new ResendMailer("re_fakekey123").verify()).toEqual({
      status: "invalid",
      message: "Resend rejected the credentials: API key is invalid",
    });
  });

  it("is unknown when the provider cannot be reached or answers with a 5xx", async () => {
    fetchMock.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));
    expect((await new ResendMailer("re_1").verify()).status).toBe("unknown");
    answer(503);
    expect((await new PostmarkMailer("t").verify()).status).toBe("unknown");
  });

  it("SendGrid: a key without mail.send cannot send, so it is invalid", async () => {
    answer(200, { scopes: ["mail.send", "user.profile.read"] });
    expect((await new SendGridMailer({ apiKey: "SG.x" }).verify()).status).toBe("valid");
    answer(200, { scopes: ["user.profile.read"] });
    expect((await new SendGridMailer({ apiKey: "SG.x" }).verify()).status).toBe("invalid");
    answer(401, { errors: [{ message: "The provided authorization grant is invalid" }] });
    expect((await new SendGridMailer({ apiKey: "SG.x" }).verify()).status).toBe("invalid");
  });

  it("Mailgun: a missing domain is invalid, a refused key is only unknown (it may be a sending key)", async () => {
    answer(404);
    expect((await new MailgunMailer({ apiKey: "k", domain: "mg.x.test" }).verify()).status).toBe("invalid");
    answer(401);
    expect((await new MailgunMailer({ apiKey: "k", domain: "mg.x.test" }).verify()).status).toBe("unknown");
  });

  it("marks a send refused with a 4xx as permanent and a 5xx as worth retrying", async () => {
    answer(403, { name: "invalid_api_key", message: "API key is invalid" });
    const refused = await new ResendMailer("re_1").send({ from: "a@x.test", to: "b@x.test", subject: "s", html: "<p/>" });
    expect(refused).toMatchObject({ success: false, permanent: true, error: "API key is invalid" });
    answer(500, { message: "oops" });
    const down = await new ResendMailer("re_1").send({ from: "a@x.test", to: "b@x.test", subject: "s", html: "<p/>" });
    expect(down).toMatchObject({ success: false, permanent: false });
  });
});

describe("EmailProviderService: credentials are checked before they are stored", () => {
  const at = new Date();
  function repo(seed: EmailProvider[] = []) {
    const rows = new Map(seed.map((p) => [p.id, p]));
    return {
      rows,
      findById: async (id: number) => rows.get(id) ?? null,
      findAll: async () => [...rows.values()],
      listForUser: async (u: string) => [...rows.values()].filter((p) => p.userId === u),
      listForOrganization: async () => [],
      create: async (d: Omit<EmailProvider, "id" | "createdAt" | "updatedAt">) => {
        const p = { ...d, id: 100 + rows.size, createdAt: at, updatedAt: at };
        rows.set(p.id, p);
        return p;
      },
      update: async (id: number, d: Partial<EmailProvider>) => {
        const p = { ...rows.get(id)!, ...d };
        rows.set(id, p);
        return p;
      },
      delete: async (id: number) => void rows.delete(id),
    };
  }
  const RESEND = { name: "Main", type: "RESEND", apiKey: "re_fakekey123" };

  it("refuses credentials the provider rejects, and stores nothing", async () => {
    const r = repo();
    const checkKey = vi.fn(async (): Promise<KeyCheck> => ({ status: "invalid", message: "Resend rejected the credentials: API key is invalid" }));
    const service = new EmailProviderService(r, undefined, undefined, null, checkKey);
    const e = await service.create("alice", RESEND).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(e.fieldErrors.general).toEqual(["Resend rejected the credentials: API key is invalid"]);
    expect(r.rows.size).toBe(0);
    expect(checkKey).toHaveBeenCalledWith({ type: "RESEND", config: expect.objectContaining({ apiKey: "re_fakekey123" }) });
  });

  it("saves when the check is unknown or limited, and says so", async () => {
    const r = repo();
    const unknown = new EmailProviderService(r, undefined, undefined, null, async () => ({ status: "unknown", message: "timeout" }));
    expect((await unknown.create("alice", RESEND)).keyCheck).toEqual({ status: "unknown", message: "timeout" });
    const limited = new EmailProviderService(r, undefined, undefined, null, async () => ({ status: "limited", message: "sending only" }));
    expect((await limited.create("alice", RESEND)).keyCheck?.status).toBe("limited");
    expect(r.rows.size).toBe(2);
  });

  it("checks again only when the credentials change", async () => {
    const r = repo([
      { id: 1, userId: "alice", name: "Main", type: "RESEND", isActive: true, config: { apiKey: "re_1", webhook_secret: "" }, createdAt: at, updatedAt: at },
    ]);
    const checkKey = vi.fn(async (): Promise<KeyCheck> => ({ status: "valid" }));
    const service = new EmailProviderService(r, undefined, undefined, null, checkKey);
    await service.update("alice", 1, { name: "Renamed" });
    expect(checkKey).not.toHaveBeenCalled();
    await service.update("alice", 1, { apiKey: "re_2" });
    expect(checkKey).toHaveBeenCalledTimes(1);
  });
});
