import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventIngestionService } from "../services/eventIngestionService";
import { FormValidationError, NotFoundError } from "../errors";
import type { Contact } from "../domain";

function contact(over: Partial<Contact>): Contact {
  return { id: 1, projectId: 1, email: "bob@x.co", name: null, locale: null, meta: null, createdAt: new Date(), updatedAt: new Date(), ...over } as Contact;
}

function fakes(seed: Contact[] = []) {
  const rows = new Map(seed.map((c) => [`${c.projectId}:${c.email}`, c]));
  const contacts = {
    findByEmail: async (projectId: number, email: string) => rows.get(`${projectId}:${email}`) ?? null,
    update: vi.fn(async (id: number, data: Partial<Contact>) => {
      const c = [...rows.values()].find((x) => x.id === id);
      if (!c) return null;
      const u = { ...c, ...data } as Contact;
      rows.set(`${u.projectId}:${u.email}`, u);
      return u;
    }),
  };
  const audience = {
    createContact: vi.fn(async (d: { projectId: number; email: string; name?: string | null; locale?: string | null; meta?: Record<string, unknown> | null }) => {
      const c = contact({ id: 50, projectId: d.projectId, email: d.email, name: d.name ?? null, locale: d.locale ?? null, meta: d.meta ?? null });
      rows.set(`${c.projectId}:${c.email}`, c);
      return c;
    }),
  };
  const automation = { triggerEvent: vi.fn(async () => {}) };
  return { service: new EventIngestionService(contacts, audience, automation), contacts, audience, automation };
}

describe("EventIngestionService.ingest", () => {
  it("validates the body", async () => {
    const { service } = fakes();
    const e1 = await service.ingest(1, {}).catch((x) => x);
    expect(e1).toBeInstanceOf(FormValidationError);
    expect(Object.keys(e1.fieldErrors).sort()).toEqual(["email", "event"]);
    const e2 = await service.ingest(1, { event: "nope", email: "a@b.co" }).catch((x) => x);
    expect(e2.fieldErrors.event).toBeDefined();
  });

  it("contact_added goes through the audience service (which starts workflows itself)", async () => {
    const { service, audience, automation } = fakes();
    const { contact: c } = await service.ingest(1, { event: "contact_added", email: "bob@x.co", name: "Bob", metadata: { plan: "pro" } });
    expect(audience.createContact).toHaveBeenCalledWith({ projectId: 1, email: "bob@x.co", name: "Bob", locale: undefined, meta: { plan: "pro" } });
    expect(c.id).toBe(50);
    expect(automation.triggerEvent).not.toHaveBeenCalled();
  });

  it("contact_updated needs an existing contact in that project, merges metadata and fires the event", async () => {
    const { service, automation } = fakes([contact({ id: 7, projectId: 1, meta: { a: 1, b: 1 } })]);
    await expect(service.ingest(2, { event: "contact_updated", email: "bob@x.co" })).rejects.toBeInstanceOf(NotFoundError);
    const { contact: c } = await service.ingest(1, { event: "contact_updated", email: "bob@x.co", name: "B", metadata: { b: 2 } });
    expect(c.meta).toEqual({ a: 1, b: 2 });
    expect(c.name).toBe("B");
    expect(automation.triggerEvent).toHaveBeenCalledWith({ event: "contact_updated", projectId: 1, contactId: 7, metadata: { b: 2 } });
  });

  it("tag_added unions tags", async () => {
    const { service } = fakes([contact({ id: 7, meta: { tags: ["a", "b"], x: 1 } })]);
    const { contact: c } = await service.ingest(1, { event: "tag_added", email: "bob@x.co", metadata: { tags: ["b", "c"] } });
    expect(c.meta).toEqual({ tags: ["a", "b", "c"], x: 1 });
    const { contact: d } = await service.ingest(1, { event: "tag_added", email: "bob@x.co" });
    expect((d.meta as any).tags).toEqual(["a", "b", "c"]);
  });

  it("order_created and event_triggered create the contact when missing and fire the event", async () => {
    const { service, audience, automation } = fakes([contact({ id: 7 })]);
    await service.ingest(1, { event: "order_created", email: "bob@x.co", metadata: { total: 5 } });
    expect(audience.createContact).not.toHaveBeenCalled();
    expect(automation.triggerEvent).toHaveBeenLastCalledWith({ event: "order_created", projectId: 1, contactId: 7, metadata: { total: 5 } });

    await service.ingest(1, { event: "event_triggered", email: "new@x.co" });
    expect(audience.createContact).toHaveBeenCalledTimes(1);
    expect(automation.triggerEvent).toHaveBeenLastCalledWith({ event: "event_triggered", projectId: 1, contactId: 50, metadata: undefined });
  });
});
