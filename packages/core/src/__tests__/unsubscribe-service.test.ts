import { describe, it, expect, vi } from "vitest";
import { UnsubscribeService } from "../services/unsubscribeService";
import { encodeUnsubscribeToken } from "../unsubscribe-token";
import type { Campaign, Contact, Suppression } from "../domain";

const SECRET = "test-secret";
const legacy = (data: unknown) => Buffer.from(JSON.stringify(data)).toString("base64url");

function fakes() {
  const contacts: Contact[] = [
    { id: 7, projectId: 1, email: "ann@example.com", unsubscribed: false } as Contact,
    { id: 8, projectId: 2, email: "bob@example.com", unsubscribed: false } as Contact,
    { id: 9, projectId: 1, email: "gone@example.com", unsubscribed: true } as Contact,
  ];
  const campaigns: Campaign[] = [{ id: 42, projectId: 1 } as Campaign, { id: 43, projectId: 2 } as Campaign];
  const suppressions: Suppression[] = [];
  const events: unknown[] = [];
  const repos = {
    contacts: {
      findById: async (id: number) => contacts.find((c) => c.id === id) ?? null,
      findByEmail: async (pid: number, email: string) => contacts.find((c) => c.projectId === pid && c.email === email) ?? null,
      unsubscribe: vi.fn(async (id: number) => { contacts.find((c) => c.id === id)!.unsubscribed = true; }),
    },
    campaigns: {
      findById: async (id: number) => campaigns.find((c) => c.id === id) ?? null,
      logEvent: vi.fn(async (e: unknown) => { events.push(e); return e as never; }),
    },
    suppressions: {
      findByProjectAndEmail: async (pid: number, email: string) => suppressions.find((s) => s.projectId === pid && s.email === email) ?? null,
      create: vi.fn(async (d: Omit<Suppression, "id" | "createdAt">) => { const s = { ...d, id: 1, createdAt: new Date() }; suppressions.push(s); return s; }),
    },
  };
  return { service: new UnsubscribeService(repos, { linkSigningSecret: SECRET }), repos, suppressions, events };
}

describe("UnsubscribeService.process", () => {
  it("rejects a forged token", async () => {
    const { service } = fakes();
    expect(await service.process("not-a-token")).toEqual({ ok: false, reason: "invalid" });
  });

  it("unsubscribes a campaign contact and logs the event", async () => {
    const { service, repos, events } = fakes();
    const token = await encodeUnsubscribeToken({ contactId: 7, projectId: 1, email: "ann@example.com", campaignId: 42 }, SECRET);
    expect(await service.process(token)).toEqual({ ok: true, alreadyUnsubscribed: false });
    expect(repos.contacts.unsubscribe).toHaveBeenCalledWith(7);
    expect(events).toEqual([{ campaignId: 42, contactId: 7, email: "ann@example.com", type: "UNSUBSCRIBE" }]);
    expect(await service.process(token)).toEqual({ ok: true, alreadyUnsubscribed: true });
  });

  it("refuses a token whose ids disagree on the project", async () => {
    const { service, repos } = fakes();
    const t1 = await encodeUnsubscribeToken({ contactId: 7, projectId: 2, campaignId: 42 }, SECRET);
    expect(await service.process(t1)).toEqual({ ok: false, reason: "invalid" });
    const t2 = await encodeUnsubscribeToken({ contactId: 8, projectId: 1, campaignId: 42 }, SECRET);
    expect(await service.process(t2)).toEqual({ ok: false, reason: "invalid" });
    expect(repos.contacts.unsubscribe).not.toHaveBeenCalled();
  });

  it("suppresses a triggered recipient who has no contact row, once", async () => {
    const { service, suppressions, events } = fakes();
    const token = await encodeUnsubscribeToken({ projectId: 1, email: "api@example.com", campaignId: 42 }, SECRET);
    expect(await service.process(token)).toEqual({ ok: true, alreadyUnsubscribed: false });
    expect(suppressions).toMatchObject([{ projectId: 1, email: "api@example.com", reason: "UNSUBSCRIBE" }]);
    expect(events).toHaveLength(1);
    expect(await service.process(token)).toEqual({ ok: true, alreadyUnsubscribed: true });
  });

  it("asks a legacy token to confirm the address, then acts only on a match", async () => {
    const { service, repos } = fakes();
    const token = legacy({ contactId: 7, campaignId: 42 });
    expect(await service.process(token)).toEqual({ ok: false, reason: "confirm_email" });
    expect(await service.process(token, { confirmEmail: "other@example.com" })).toEqual({ ok: false, reason: "not_found" });
    expect(await service.process(token, { confirmEmail: " ANN@example.com " })).toEqual({ ok: true, alreadyUnsubscribed: false });
    expect(repos.contacts.unsubscribe).toHaveBeenCalledWith(7);
  });

  it("answers not_found when nothing identifies a recipient", async () => {
    const { service } = fakes();
    const token = await encodeUnsubscribeToken({ contactId: 999, campaignId: 42 }, SECRET);
    expect(await service.process(token)).toEqual({ ok: false, reason: "not_found" });
  });
});
