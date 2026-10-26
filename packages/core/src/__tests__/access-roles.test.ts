import { describe, it, expect } from "vitest";
import { AccessGuard, ownerAccessPolicy, type AccessPolicy } from "../access";
import { ForbiddenError, NotFoundError } from "../errors";
import type { EmailProvider, Project } from "../domain";
import { EmailProviderService } from "../services/emailProviderService";
import { ProjectService } from "../services/projectService";

// 7.4.4: a managed viewer role. Vic is a member of acme who may read
// everything there and change nothing; Alice is an editor; Carol is outside.
const roles: Record<string, "editor" | "viewer"> = { alice: "editor", vic: "viewer" };
const viewerPolicy: AccessPolicy = {
  async scopeFor(userId) {
    return { userId, organizationId: roles[userId] ? "acme" : null };
  },
  async mayAccess(userId, owner, action) {
    if (owner.organizationId !== "acme") return false;
    const role = roles[userId];
    if (!role) return false;
    return action === "read" || role === "editor";
  },
};

const orgProject = {
  id: 10, userId: "alice", organizationId: "acme", name: "Acme", createdAt: new Date(), updatedAt: new Date(),
} as Project;
const orgProvider = {
  id: 20, userId: "alice", organizationId: "acme", name: "Shared", type: "RESEND", config: { apiKey: "k" },
  isActive: true, createdAt: new Date(), updatedAt: new Date(),
} as EmailProvider;
const projects = { findById: async (id: number) => (id === 10 ? orgProject : null) };
const guard = new AccessGuard(projects, viewerPolicy);

describe("AccessGuard with read and write", () => {
  it("lets a viewer read and refuses a write with ForbiddenError", async () => {
    await expect(guard.requireProject("vic", 10, "read")).resolves.toBe(orgProject);
    const error = await guard.requireProject("vic", 10, "write").catch((e) => e);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.statusCode).toBe(403);
  });

  it("names the record, not its project, for a record inside a project", async () => {
    const record = { id: 5, projectId: 10 };
    await expect(guard.requireInProject("vic", record, "Template", "read")).resolves.toBe(record);
    const error = await guard.requireInProject("vic", record, "Template", "write").catch((e) => e);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe("You can view this template but not change it");
  });

  it("lets an editor write", async () => {
    await expect(guard.requireProject("alice", 10, "write")).resolves.toBe(orgProject);
  });

  it("refuses an outsider and a missing record with NotFoundError for both actions", async () => {
    for (const action of ["read", "write"] as const) {
      await expect(guard.requireProject("carol", 10, action)).rejects.toBeInstanceOf(NotFoundError);
      await expect(guard.requireProject("vic", 404, action)).rejects.toBeInstanceOf(NotFoundError);
      await expect(guard.requireOwned("carol", orgProvider, "Provider", action)).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});

describe("services under a viewer role", () => {
  it("a viewer reads a shared provider but cannot edit, toggle or delete it", async () => {
    const providers = new EmailProviderService(
      { findById: async (id: number) => (id === 20 ? orgProvider : null) } as never,
      guard,
    );
    await expect(providers.requireOwned("vic", 20, "read")).resolves.toBe(orgProvider);
    await expect(providers.update("vic", 20, { name: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(providers.setActive("vic", 20, false)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(providers.delete("vic", 20)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a viewer opens a project but cannot change it; linking a provider needs only read on it", async () => {
    const update = async (_id: number, d: Partial<Project>) => ({ ...orgProject, ...d });
    const service = new ProjectService(
      {
        projects: { ...projects, update } as never,
        providers: { findById: async () => orgProvider },
        aiProviders: { findById: async () => null },
      },
      guard,
    );
    await expect(service.require("vic", 10, "read")).resolves.toBe(orgProject);
    await expect(service.update("vic", 10, { name: "Renamed" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.delete("vic", 10)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.update("alice", 10, { name: "Acme", providerId: "20" })).resolves.toMatchObject({
      providerId: 20,
    });
  });
});

describe("AccessGuard.requireCreate", () => {
  const createPolicy: AccessPolicy = {
    ...viewerPolicy,
    async mayCreate(userId) {
      return roles[userId] === "editor";
    },
  };
  const createGuard = new AccessGuard(projects, createPolicy);

  it("gives an editor the scope and refuses a viewer with ForbiddenError", async () => {
    await expect(createGuard.requireCreate("alice", "Project")).resolves.toEqual({
      userId: "alice",
      organizationId: "acme",
    });
    const error = await createGuard.requireCreate("vic", "Project").catch((e) => e);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe("You cannot create a project here");
  });

  it("allows everyone when the policy has no mayCreate", async () => {
    await expect(guard.requireCreate("vic", "Project")).resolves.toEqual({ userId: "vic", organizationId: "acme" });
  });

  it("stops a viewer from creating a project or a provider through the services", async () => {
    const created: unknown[] = [];
    const service = new ProjectService(
      {
        projects: { ...projects, create: async (d: unknown) => (created.push(d), orgProject) } as never,
        providers: { findById: async () => null },
        aiProviders: { findById: async () => null },
      },
      createGuard,
    );
    await expect(service.create("vic", { name: "New" })).rejects.toBeInstanceOf(ForbiddenError);
    const providers = new EmailProviderService(
      { create: async (d: unknown) => (created.push(d), orgProvider) } as never,
      createGuard,
    );
    await expect(
      providers.create("vic", { name: "x", type: "RESEND", apiKey: "re_123456789" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(created).toEqual([]);
  });
});

describe("ownerAccessPolicy", () => {
  it("gives the owner both actions and everyone else neither", async () => {
    for (const action of ["read", "write"] as const) {
      expect(await ownerAccessPolicy.mayAccess("alice", { userId: "alice" }, action)).toBe(true);
      expect(await ownerAccessPolicy.mayAccess("bob", { userId: "alice" }, action)).toBe(false);
    }
  });
});
