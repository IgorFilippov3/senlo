import { describe, it, expect, vi } from "vitest";
import { AccessGuard, listInScope, type AccessPolicy } from "../access";
import type { AiProvider, EmailProvider, Project } from "../domain";
import { NotFoundError } from "../errors";
import { AiProviderService } from "../services/ai";
import { DashboardService } from "../services/dashboardService";
import { EmailProviderService } from "../services/emailProviderService";
import { ProjectService } from "../services/projectService";

// bob works in organization "acme"; alice has only personal records.
const orgScope: AccessPolicy = {
  async scopeFor(userId) {
    return { userId, organizationId: userId === "bob" ? "acme" : null };
  },
  async mayAccess(userId, owner) {
    if (owner.organizationId) return owner.organizationId === "acme" && userId === "bob";
    return !!userId && owner.userId === userId;
  },
};

const at = new Date();
const project = (id: number, userId: string, organizationId: string | null = null) =>
  ({ id, userId, organizationId, name: `p${id}`, createdAt: at, updatedAt: at }) as Project;
const rows = [project(1, "alice"), project(2, "bob"), project(3, "carol", "acme")];

function listing<T extends { userId?: string | null; organizationId?: string | null }>(items: T[]) {
  return {
    listForUser: async (u: string) => items.filter((i) => i.userId === u && !i.organizationId),
    listForOrganization: async (o: string) => items.filter((i) => i.organizationId === o),
  };
}

const projects = {
  ...listing(rows),
  findById: async (id: number) => rows.find((p) => p.id === id) ?? null,
  findAll: async () => rows,
  create: vi.fn(async (d: Partial<Project>) => ({ ...project(9, d.userId!), ...d }) as Project),
  update: async () => null,
  delete: async () => {},
};
const guard = new AccessGuard(projects, orgScope);

describe("listInScope", () => {
  it("lists the organization's rows for an organization scope, the user's own otherwise", async () => {
    expect((await listInScope({ userId: "bob", organizationId: "acme" }, projects)).map((p) => p.id)).toEqual([3]);
    expect((await listInScope({ userId: "bob", organizationId: null }, projects)).map((p) => p.id)).toEqual([2]);
  });
});

describe("services in an organization scope", () => {
  it("lists the organization's projects and stamps it on a new one", async () => {
    const service = new ProjectService({ projects, providers: { findById: async () => null }, aiProviders: { findById: async () => null } }, guard);
    expect((await service.listForUser("bob")).map((p) => p.id)).toEqual([3]);
    expect((await service.listForUser("alice")).map((p) => p.id)).toEqual([1]);

    await service.create("bob", { name: "New" });
    expect(projects.create).toHaveBeenLastCalledWith({ name: "New", description: null, userId: "bob", organizationId: "acme" });
    await service.create("alice", { name: "Mine" });
    expect(projects.create).toHaveBeenLastCalledWith({ name: "Mine", description: null, userId: "alice", organizationId: null });
  });

  it("lists and creates email and AI providers in the scope", async () => {
    const email = [{ id: 1, userId: "carol", organizationId: "acme" }, { id: 2, userId: "bob" }] as EmailProvider[];
    const emailRepo = {
      ...listing(email),
      findById: async () => null,
      findAll: async () => email,
      create: vi.fn(async (d: Omit<EmailProvider, "id" | "createdAt" | "updatedAt">) => ({ ...d, id: 5, createdAt: at, updatedAt: at })),
      update: async () => null,
      delete: async () => {},
    };
    const emailService = new EmailProviderService(emailRepo, guard);
    expect((await emailService.listForUser("bob")).map((p) => p.id)).toEqual([1]);
    await emailService.create("bob", { name: "Shared", type: "RESEND", apiKey: "k" });
    expect(emailRepo.create.mock.calls[0][0]).toMatchObject({ userId: "bob", organizationId: "acme" });

    const ai = [{ id: 7, userId: "carol", organizationId: "acme" }] as AiProvider[];
    const aiRepo = {
      ...listing(ai),
      findById: async () => null,
      create: vi.fn(async (d: Omit<AiProvider, "id" | "createdAt" | "updatedAt">) => ({ ...d, id: 8, createdAt: at, updatedAt: at })),
      update: async () => null,
      delete: async () => {},
    };
    const aiService = new AiProviderService(aiRepo, guard);
    expect((await aiService.listForUser("bob")).map((p) => p.id)).toEqual([7]);
    expect(await aiService.listForUser("alice")).toEqual([]);
    await aiService.create("bob", { name: "Shared", type: "OPENAI", apiKey: "k" });
    expect(aiRepo.create.mock.calls[0][0]).toMatchObject({ userId: "bob", organizationId: "acme" });
  });

  it("aggregates the dashboard over the checked project or the whole scope", async () => {
    const dashboard = {
      getGlobalStats: vi.fn(async () => ({ totalSent: 0, delivered: 0, bounced: 0, opened: 0, clicked: 0, savedSends: 0 })),
      getActivityStats: vi.fn(async () => []),
      getRecentEvents: vi.fn(async () => []),
    };
    const service = new DashboardService(dashboard, projects, guard);

    await service.getData("bob", 3);
    expect(dashboard.getGlobalStats).toHaveBeenLastCalledWith([3]);
    await service.getStats("bob");
    expect(dashboard.getGlobalStats).toHaveBeenLastCalledWith([3]);
    await service.getStats("alice");
    expect(dashboard.getGlobalStats).toHaveBeenLastCalledWith([1]);

    await expect(service.getData("alice", 3)).rejects.toThrow(NotFoundError);
  });
});
