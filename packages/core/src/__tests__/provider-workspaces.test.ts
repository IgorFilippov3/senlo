// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { AccessGuard } from "../access";
import { EmailProviderService } from "../services/emailProviderService";
import { NotFoundError, ValidationError } from "../errors";
import type { EmailProvider, Project } from "../domain";

const at = new Date();

function providerRepo(seed: EmailProvider[]) {
  const rows = new Map(seed.map((p) => [p.id, p]));
  let nextId = 100;
  return {
    rows,
    findById: async (id: number) => rows.get(id) ?? null,
    findAll: async () => [...rows.values()],
    listForUser: async (userId: string) => [...rows.values()].filter((p) => p.userId === userId),
    listForOrganization: async (o: string) => [...rows.values()].filter((p) => p.organizationId === o),
    create: async (data: Omit<EmailProvider, "id" | "createdAt" | "updatedAt">) => {
      const p = { ...data, id: nextId++, createdAt: at, updatedAt: at };
      rows.set(p.id, p);
      return p;
    },
    update: async (id: number, data: Partial<EmailProvider>) => {
      const p = rows.get(id);
      if (!p) return null;
      const u = { ...p, ...data };
      rows.set(id, u);
      return u;
    },
    delete: async (id: number) => {
      rows.delete(id);
    },
  };
}

function projectRepo(seed: Project[]) {
  const rows = new Map(seed.map((p) => [p.id, p]));
  return {
    rows,
    findById: async (id: number) => rows.get(id) ?? null,
    listForUser: async (userId: string) => [...rows.values()].filter((p) => p.userId === userId && !p.organizationId),
    listForOrganization: async (o: string) => [...rows.values()].filter((p) => p.organizationId === o),
    update: async (id: number, data: Partial<Project>) => {
      const p = rows.get(id);
      if (!p) return null;
      const u = { ...p, ...data };
      rows.set(id, u);
      return u;
    },
  };
}

const provider = (id: number, userId = "alice"): EmailProvider => ({
  id, userId, name: `P${id}`, type: "RESEND", isActive: true,
  config: { apiKey: "re_1", webhook_secret: "" }, createdAt: at, updatedAt: at,
});
const workspace = (id: number, providerId: number | null, userId = "alice"): Project =>
  ({ id, userId, name: `W${id}`, providerId, createdAt: at, updatedAt: at }) as Project;

const RESEND = { name: "Main", type: "RESEND", apiKey: "re_live" };

describe("EmailProviderService: workspaces", () => {
  let providers: ReturnType<typeof providerRepo>;
  let projects: ReturnType<typeof projectRepo>;
  let service: EmailProviderService;
  const providerOf = (workspaceId: number) => projects.rows.get(workspaceId)!.providerId;

  beforeEach(() => {
    providers = providerRepo([provider(1), provider(2), provider(9, "bob")]);
    projects = projectRepo([workspace(10, null), workspace(11, 1), workspace(12, 2), workspace(20, null, "bob")]);
    service = new EmailProviderService(providers, new AccessGuard(projects), undefined, projects);
  });

  it("selects a new provider for the ticked workspaces", async () => {
    const created = await service.create("alice", { ...RESEND, workspaceIds: [10, 11] });
    expect(providerOf(10)).toBe(created.id);
    expect(providerOf(11)).toBe(created.id);
    expect(providerOf(12)).toBe(2);
  });

  it("changes no workspace without workspaceIds", async () => {
    await service.create("alice", RESEND);
    expect([providerOf(10), providerOf(11), providerOf(12)]).toEqual([null, 1, 2]);
  });

  it("stores nothing when a ticked workspace is not the user's", async () => {
    const before = providers.rows.size;
    await expect(service.create("alice", { ...RESEND, workspaceIds: [10, 20] })).rejects.toBeInstanceOf(NotFoundError);
    expect(providers.rows.size).toBe(before);
    expect(providerOf(10)).toBeNull();
    expect(providerOf(20)).toBeNull();
  });

  it("on edit, takes the list as the whole set: adds the ticked, drops the unticked", async () => {
    await service.update("alice", 1, { workspaceIds: [10, 12] });
    expect(providerOf(10)).toBe(1);
    expect(providerOf(11)).toBeNull();
    expect(providerOf(12)).toBe(1);
  });

  it("on edit without workspaceIds, leaves the workspaces alone", async () => {
    await service.update("alice", 1, { name: "Renamed" });
    expect(providerOf(11)).toBe(1);
  });

  it("on delete, switches the workspaces that used it to the replacement", async () => {
    await service.delete("alice", 1, { replacementId: 2 });
    expect(providers.rows.has(1)).toBe(false);
    expect(providerOf(11)).toBe(2);
    expect(providerOf(10)).toBeNull();
  });

  it("on delete without a replacement, does not touch the workspaces (the database clears them)", async () => {
    await service.delete("alice", 1);
    expect(providers.rows.has(1)).toBe(false);
    expect(providerOf(11)).toBe(1);
  });

  it("refuses a replacement that is the provider itself or not the user's", async () => {
    await expect(service.delete("alice", 1, { replacementId: 1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.delete("alice", 1, { replacementId: 9 })).rejects.toBeInstanceOf(NotFoundError);
    expect(providers.rows.has(1)).toBe(true);
    expect(providerOf(11)).toBe(1);
  });
});
