import { describe, it, expect, beforeEach, vi } from "vitest";
import { CampaignService } from "../services/campaignService";
import { FormValidationError, NotFoundError, ValidationError } from "../errors";
import type { Campaign, Project } from "../domain";
import type { EmailTemplate } from "../emailTemplate";

const p1 = { id: 1, userId: "alice", name: "A", providerId: 5, createdAt: new Date(), updatedAt: new Date() } as Project;
const p2 = { id: 2, userId: "bob", name: "B", providerId: 5, createdAt: new Date(), updatedAt: new Date() } as Project;
const p3 = { id: 3, userId: "alice", name: "C", providerId: null, createdAt: new Date(), updatedAt: new Date() } as Project;

const t1 = { id: 10, projectId: 1, name: "t1" } as EmailTemplate;
const t2 = { id: 20, projectId: 2, name: "t2" } as EmailTemplate;

function campaign(over: Partial<Campaign>): Campaign {
  return { id: 100, projectId: 1, name: "c", type: "TRIGGERED", status: "DRAFT", templateId: 10, listId: null, createdAt: new Date(), updatedAt: new Date(), ...over } as Campaign;
}

function fakes(seed: Campaign[]) {
  const rows = new Map(seed.map((c) => [c.id, c]));
  const updates: { id: number; data: Partial<Campaign> }[] = [];
  const queue = { add: vi.fn(async () => ({}) as never) };
  const repos = {
    projects: {
      findById: async (id: number) => [p1, p2, p3].find((p) => p.id === id) ?? null,
      findByUser: async (u: string) => [p1, p2, p3].filter((p) => p.userId === u),
    },
    templates: { findById: async (id: number) => [t1, t2].find((t) => t.id === id) ?? null },
    campaigns: {
      findById: async (id: number) => rows.get(id) ?? null,
      findByProject: async (pid: number) => [...rows.values()].filter((c) => c.projectId === pid),
      create: async (d: Omit<Campaign, "id" | "createdAt" | "updatedAt">) => {
        const c = { ...d, id: 999, createdAt: new Date(), updatedAt: new Date() } as Campaign;
        rows.set(999, c);
        return c;
      },
      update: async (id: number, data: Partial<Campaign>) => {
        updates.push({ id, data });
        const c = rows.get(id);
        if (!c) return null;
        const u = { ...c, ...data } as Campaign;
        rows.set(id, u);
        return u;
      },
      delete: async (id: number) => { rows.delete(id); },
      getEventStatsByCampaign: async () => ({ opens: { unique: 1, total: 2 }, clicks: { unique: 3, total: 4 } }),
      getPaginatedEventsByCampaign: async () => ({ events: [], total: 0 }),
      getLinkStatsByCampaign: async () => [],
      getTimeSeriesStatsByCampaign: async () => [],
    },
    sendLogs: { getStatsByCampaign: async () => ({ sent: 10, delivered: 9, errors: 1 }) },
  };
  const service = new CampaignService(repos as never, queue);
  return { service, rows, updates, queue };
}

describe("CampaignService access", () => {
  const seed = [campaign({ id: 100, projectId: 1 }), campaign({ id: 200, projectId: 2, templateId: 20 })];

  it("fails another user's campaign and a missing one the same way", async () => {
    const { service } = fakes(seed);
    const foreign = await service.getDetails("alice", 200).catch((e) => e);
    const missing = await service.getDetails("alice", 1).catch((e) => e);
    expect(foreign).toBeInstanceOf(NotFoundError);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect(foreign.message).toBe(missing.message);
    await expect(service.getEvents("alice", 200, { page: 1, pageSize: 10 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getLinkStats("alice", 200)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.send("alice", 200)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete("alice", 200)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.listForProject("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists campaigns across the user's projects only", async () => {
    const { service } = fakes(seed);
    expect((await service.listForUser("alice")).map((c) => c.id)).toEqual([100]);
    expect((await service.listForProject("alice", 1)).map((c) => c.id)).toEqual([100]);
  });

  it("merges send and event stats in details", async () => {
    const { service } = fakes(seed);
    const d = await service.getDetails("alice", 100);
    expect(d?.template.id).toBe(10);
    expect(d?.stats).toEqual({ sent: 10, delivered: 9, errors: 1, opens: { unique: 1, total: 2 }, clicks: { unique: 3, total: 4 } });
  });
});

describe("CampaignService.createTriggered", () => {
  it("creates a draft trigger from form fields", async () => {
    const { service } = fakes([]);
    const c = await service.createTriggered("alice", {
      name: " Welcome ", projectId: "1", templateId: "10", fromEmail: "a@b.co", variablesSchema: '{"x":1}',
    });
    expect(c).toMatchObject({ name: "Welcome", projectId: 1, templateId: 10, type: "TRIGGERED", status: "DRAFT", listId: null, variablesSchema: { x: 1 } });
  });

  it("takes an empty sender address as none", async () => {
    const { service } = fakes([]);
    const c = await service.createTriggered("alice", { name: "x", projectId: 1, templateId: 10, fromEmail: "" });
    expect(c.fromEmail).toBeNull();
  });

  it("reports field errors", async () => {
    const { service } = fakes([]);
    const e = await service.createTriggered("alice", { name: "", projectId: "", templateId: "x", fromEmail: "nope" }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(Object.keys(e.fieldErrors).sort()).toEqual(["fromEmail", "name", "projectId", "templateId"]);
  });

  it("refuses another user's project and a template from another project", async () => {
    const { service } = fakes([]);
    await expect(service.createTriggered("alice", { name: "x", projectId: 2, templateId: 20 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.createTriggered("alice", { name: "x", projectId: 1, templateId: 20 })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("CampaignService.updateTriggered", () => {
  it("checks every locale template against the project", async () => {
    const { service } = fakes([campaign({ id: 100 })]);
    await expect(
      service.updateTriggered("alice", 100, { name: "n", localeTemplates: JSON.stringify({ en: 10, de: 20 }) }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const ok = await service.updateTriggered("alice", 100, { name: "n", localeTemplates: JSON.stringify({ en: 10 }) });
    expect(ok.localeTemplates).toEqual({ en: 10 });
  });

  it("clears the sender address when the field is emptied", async () => {
    const { service } = fakes([campaign({ id: 100, fromEmail: "a@b.co" })]);
    const c = await service.updateTriggered("alice", 100, { name: "n", fromEmail: " " });
    expect(c.fromEmail).toBeNull();
  });

  it("treats unparsable JSON fields as unset", async () => {
    const { service } = fakes([campaign({ id: 100 })]);
    const c = await service.updateTriggered("alice", 100, { name: "n", variablesSchema: "{bad", localeTemplates: "" });
    expect(c.variablesSchema).toBeNull();
    expect(c.localeTemplates).toBeNull();
  });
});

describe("CampaignService.send", () => {
  it("needs a provider on the workspace and a list on the campaign", async () => {
    const { service, queue } = fakes([campaign({ id: 100, projectId: 3, listId: 7 }), campaign({ id: 101, projectId: 1, listId: null })]);
    await expect(service.send("alice", 100)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.send("alice", 101)).rejects.toBeInstanceOf(ValidationError);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("marks the campaign sending and queues the dispatch", async () => {
    const { service, queue, updates } = fakes([campaign({ id: 100, listId: 7 })]);
    const { project } = await service.send("alice", 100);
    expect(project.id).toBe(1);
    expect(updates[0]).toMatchObject({ id: 100, data: { status: "SENDING", sentAt: expect.any(Date) } });
    expect(queue.add).toHaveBeenCalledWith(expect.stringMatching(/^dispatch-campaign-100-/), { campaignId: 100, userId: "alice" });
  });
});

describe("CampaignService.delete", () => {
  it("deletes and returns the project for revalidation", async () => {
    const { service, rows } = fakes([campaign({ id: 100 })]);
    expect((await service.delete("alice", 100)).project.id).toBe(1);
    expect(rows.has(100)).toBe(false);
  });
});
