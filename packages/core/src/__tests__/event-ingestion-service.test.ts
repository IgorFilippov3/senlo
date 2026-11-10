import { describe, it, expect, vi } from "vitest";
import { EventIngestionService } from "../services/eventIngestionService";
import { FormValidationError, NotFoundError } from "../errors";
import type { Contact, ContactEvent } from "../domain";

function contact(over: Partial<Contact>): Contact {
  return { id: 1, projectId: 1, email: "bob@x.co", name: null, locale: null, meta: null, createdAt: new Date(), updatedAt: new Date(), ...over } as Contact;
}

function fakes(seed: Contact[] = [], seen: ContactEvent[] = []) {
  const rows = new Map(seed.map((c) => [`${c.projectId}:${c.email}`, c]));
  const contacts = {
    findByEmail: async (projectId: number, email: string) => rows.get(`${projectId}:${email}`) ?? null,
    findById: async (id: number) => [...rows.values()].find((c) => c.id === id) ?? null,
    update: vi.fn(async (id: number, data: Partial<Contact>) => {
      const c = [...rows.values()].find((x) => x.id === id);
      if (!c) return null;
      const u = { ...c, ...data } as Contact;
      rows.set(`${u.projectId}:${u.email}`, u);
      return u;
    }),
  };
  const events = {
    findByIdempotencyKey: vi.fn(
      async (projectId: number, key: string) => seen.find((e) => e.projectId === projectId && e.idempotencyKey === key) ?? null,
    ),
  };
  const audience = {
    createContact: vi.fn(async (d: { projectId: number; email: string; name?: string | null; locale?: string | null; meta?: Record<string, unknown> | null }) => {
      const c = contact({ id: 50, projectId: d.projectId, email: d.email, name: d.name ?? null, locale: d.locale ?? null, meta: d.meta ?? null });
      rows.set(`${c.projectId}:${c.email}`, c);
      return c;
    }),
  };
  const automation = { handleEvent: vi.fn(async () => ({ event: null, duplicate: false })) };
  return { service: new EventIngestionService(contacts, events, audience, automation), contacts, events, audience, automation };
}

describe("EventIngestionService.ingest", () => {
  it("validates the body", async () => {
    const { service } = fakes();
    const e1 = await service.ingest(1, {}).catch((x) => x);
    expect(e1).toBeInstanceOf(FormValidationError);
    expect(Object.keys(e1.fieldErrors).sort()).toEqual(["email", "event"]);
  });

  it("accepts any lowercase event name and refuses malformed ones", async () => {
    const { service } = fakes([contact({ id: 7 })]);
    for (const event of ["trial_started", "invoice.paid", "billing:failed", "a", "x-1", "9lives"]) {
      await expect(service.ingest(1, { event, email: "bob@x.co" })).resolves.toBeDefined();
    }
    for (const event of ["Trial", "_x", "has space", "", "x".repeat(65), "é"]) {
      const e = await service.ingest(1, { event, email: "bob@x.co" }).catch((x) => x);
      expect(e, event).toBeInstanceOf(FormValidationError);
      expect(e.fieldErrors.event, event).toBeDefined();
    }
  });

  it("refuses a payload over 32 KB", async () => {
    const { service } = fakes([contact({ id: 7 })]);
    const big = { blob: "x".repeat(33 * 1024) };
    const e = await service.ingest(1, { event: "x", email: "bob@x.co", payload: big }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(e.fieldErrors.payload).toBeDefined();
    await expect(service.ingest(1, { event: "x", email: "bob@x.co", payload: { blob: "x".repeat(1000) } })).resolves.toBeDefined();
  });

  it("contact_added goes through the audience service with its payload and key", async () => {
    const { service, audience, automation } = fakes();
    const { contact: c } = await service.ingest(1, {
      event: "contact_added",
      email: "bob@x.co",
      name: "Bob",
      metadata: { plan: "pro" },
      payload: { source: "landing" },
      idempotencyKey: "k1",
    });
    expect(audience.createContact).toHaveBeenCalledWith(
      { projectId: 1, email: "bob@x.co", name: "Bob", locale: undefined, meta: { plan: "pro" } },
      { payload: { source: "landing" }, idempotencyKey: "k1" },
    );
    expect(c.id).toBe(50);
    expect(automation.handleEvent).not.toHaveBeenCalled();
  });

  it("contact_updated needs an existing contact, merges metadata and dispatches the payload, not the metadata", async () => {
    const { service, automation } = fakes([contact({ id: 7, projectId: 1, meta: { a: 1, b: 1 } })]);
    await expect(service.ingest(2, { event: "contact_updated", email: "bob@x.co" })).rejects.toBeInstanceOf(NotFoundError);
    const { contact: c } = await service.ingest(1, { event: "contact_updated", email: "bob@x.co", name: "B", metadata: { b: 2 } });
    expect(c.meta).toEqual({ a: 1, b: 2 });
    expect(c.name).toBe("B");
    expect(automation.handleEvent).toHaveBeenCalledWith({
      projectId: 1,
      contactId: 7,
      name: "contact_updated",
      payload: {},
      idempotencyKey: undefined,
    });
  });

  it("tag_added takes tags from payload.tags, unions them and dispatches them", async () => {
    const { service, automation } = fakes([contact({ id: 7, meta: { tags: ["a", "b"], x: 1 } })]);
    const { contact: c } = await service.ingest(1, { event: "tag_added", email: "bob@x.co", payload: { tags: ["b", " c "] } });
    expect(c.meta).toEqual({ tags: ["a", "b", "c"], x: 1 });
    expect(automation.handleEvent).toHaveBeenLastCalledWith(expect.objectContaining({ name: "tag_added", payload: { tags: ["b", "c"] } }));

    for (const payload of [undefined, {}, { tags: [] }, { tags: "a" }, { tags: [1] }, { tags: [""] }]) {
      const e = await service.ingest(1, { event: "tag_added", email: "bob@x.co", payload }).catch((x) => x);
      expect(e, JSON.stringify(payload)).toBeInstanceOf(FormValidationError);
      expect(e.fieldErrors.payload).toBeDefined();
    }
    // metadata.tags is a contact attribute now, not a tag list.
    const e = await service.ingest(1, { event: "tag_added", email: "bob@x.co", metadata: { tags: ["z"] } }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
  });

  it("a custom event creates a missing contact, merges attributes of a known one and dispatches its payload", async () => {
    const { service, audience, automation, contacts } = fakes([contact({ id: 7, meta: { a: 1 } })]);

    await service.ingest(1, { event: "order_created", email: "bob@x.co", metadata: { vip: true }, payload: { total: 5 } });
    expect(audience.createContact).not.toHaveBeenCalled();
    expect(contacts.update).toHaveBeenCalledWith(7, { name: undefined, locale: undefined, meta: { a: 1, vip: true } });
    expect(automation.handleEvent).toHaveBeenLastCalledWith({
      projectId: 1,
      contactId: 7,
      name: "order_created",
      payload: { total: 5 },
      idempotencyKey: undefined,
    });

    contacts.update.mockClear();
    await service.ingest(1, { event: "trial_started", email: "bob@x.co" });
    expect(contacts.update).not.toHaveBeenCalled();

    await service.ingest(1, { event: "trial_started", email: "new@x.co", metadata: { plan: "pro" } });
    expect(audience.createContact).toHaveBeenCalledWith({ projectId: 1, email: "new@x.co", name: undefined, locale: undefined, meta: { plan: "pro" } });
    expect(automation.handleEvent).toHaveBeenLastCalledWith(expect.objectContaining({ contactId: 50, name: "trial_started", payload: {} }));
  });

  it("a repeated idempotency key changes and dispatches nothing and returns the contact", async () => {
    const seen = [{ id: 1, projectId: 1, contactId: 7, name: "x", payload: {}, idempotencyKey: "k1", createdAt: new Date() }];
    const { service, automation, contacts } = fakes([contact({ id: 7 })], seen);

    const r = await service.ingest(1, { event: "x", email: "bob@x.co", metadata: { a: 1 } }, { idempotencyKey: "k1" });
    expect(r.duplicate).toBe(true);
    expect(r.contact.id).toBe(7);
    expect(contacts.update).not.toHaveBeenCalled();
    expect(automation.handleEvent).not.toHaveBeenCalled();

    // Another key: a new event.
    const other = await service.ingest(1, { event: "x", email: "bob@x.co", idempotencyKey: "k2" });
    expect(other.duplicate).toBe(false);
    expect(automation.handleEvent).toHaveBeenCalledTimes(1);
  });

  it("the header key wins over the body key and is length-checked", async () => {
    const { service, automation } = fakes([contact({ id: 7 })]);
    await service.ingest(1, { event: "x", email: "bob@x.co", idempotencyKey: "body" }, { idempotencyKey: "header" });
    expect(automation.handleEvent).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "header" }));

    const e = await service.ingest(1, { event: "x", email: "bob@x.co" }, { idempotencyKey: "k".repeat(256) }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(e.fieldErrors.idempotencyKey).toBeDefined();
  });

  it("reports a duplicate found only at insert time (two requests racing with one key)", async () => {
    const { service, automation } = fakes([contact({ id: 7 })]);
    automation.handleEvent.mockResolvedValueOnce({ event: null, duplicate: true });
    const r = await service.ingest(1, { event: "x", email: "bob@x.co", idempotencyKey: "k1" });
    expect(r.duplicate).toBe(true);
  });
});
