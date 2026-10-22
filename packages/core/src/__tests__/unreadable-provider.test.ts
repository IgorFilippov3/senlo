import { describe, it, expect } from "vitest";
import { aesGcmCipher, openConfigOrFlag, sealConfig, SealedConfigError } from "../secrets";
import { EmailProviderService } from "../services/emailProviderService";
import { MailerFactory } from "../services/mail/index";
import { FormValidationError } from "../errors";
import type { EmailProvider } from "../domain";

// 7.1: one provider row sealed with another SECRETS_KEY used to fail the whole
// providers list. It is now flagged, listed, refused for sending, and fixed by
// entering the credentials again.

const unreadable: EmailProvider = {
  id: 3, userId: "alice", name: "Old", type: "RESEND", isActive: true,
  config: {}, configUnreadable: true, createdAt: new Date(), updatedAt: new Date(),
};

function repo(rows: EmailProvider[]) {
  const map = new Map(rows.map((p) => [p.id, p]));
  return {
    findById: async (id: number) => map.get(id) ?? null,
    findAll: async () => [...map.values()],
    listForUser: async () => [...map.values()],
    listForOrganization: async () => [],
    create: async () => { throw new Error("unused"); },
    update: async (id: number, data: Partial<EmailProvider>) => {
      const u = { ...map.get(id)!, ...data, configUnreadable: undefined };
      map.set(id, u);
      return u;
    },
    delete: async () => {},
  };
}

describe("openConfigOrFlag", () => {
  it("opens a readable config and flags one sealed with another key", async () => {
    const stored = await sealConfig(aesGcmCipher("key-one"), { apiKey: "re_1" });
    expect(await openConfigOrFlag(aesGcmCipher("key-one"), stored)).toEqual({
      config: { apiKey: "re_1" },
      unreadable: false,
    });
    expect(await openConfigOrFlag(aesGcmCipher("key-two"), stored)).toEqual({ config: {}, unreadable: true });
  });
});

describe("a provider whose config cannot be decrypted", () => {
  it("is listed, flagged and without secrets", async () => {
    const readable = { ...unreadable, id: 4, name: "New", config: { apiKey: "re_2" }, configUnreadable: undefined };
    const list = await new EmailProviderService(repo([unreadable, readable]) as never).listForUser("alice");
    expect(list.map((p) => [p.name, !!p.configUnreadable, p.secretsSet])).toEqual([
      ["Old", true, []],
      ["New", false, ["apiKey"]],
    ]);
  });

  it("is refused for sending with an error that names it", () => {
    expect(() => MailerFactory.create(unreadable)).toThrow(SealedConfigError);
    expect(() => MailerFactory.create(unreadable)).toThrow(/Email provider 3/);
  });

  it("needs every field on edit, then is readable again", async () => {
    const service = new EmailProviderService(repo([unreadable]) as never);
    const e = await service.update("alice", 3, { name: "Old" }).catch((err) => err);
    expect(e).toBeInstanceOf(FormValidationError);
    expect((e as FormValidationError).fieldErrors).toEqual({ apiKey: ["Resend API key is required"] });

    const fixed = await service.update("alice", 3, { apiKey: "re_new" });
    expect(fixed.configUnreadable).toBeFalsy();
    expect(fixed.secretsSet).toEqual(["apiKey"]);
  });
});
