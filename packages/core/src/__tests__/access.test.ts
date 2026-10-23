import { describe, it, expect } from "vitest";
import { AccessGuard, ownerAccessPolicy, type AccessPolicy } from "../access";
import { NotFoundError } from "../errors";
import type { EmailProvider, Project } from "../domain";
import { EmailProviderService } from "../services/emailProviderService";
import { ProjectService } from "../services/projectService";

const project = (id: number, userId: string | null): Project => ({
  id,
  userId,
  name: `p${id}`,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const projects = new Map<number, Project>([
  [1, project(1, "alice")],
  [2, project(2, "bob")],
  [3, project(3, null)],
]);

const guard = new AccessGuard({
  findById: async (id: number) => projects.get(id) ?? null,
});

describe("AccessGuard.requireProject", () => {
  it("returns the user's own project", async () => {
    await expect(guard.requireProject("alice", 1, "read")).resolves.toMatchObject({ id: 1 });
  });

  it("refuses another user's project", async () => {
    await expect(guard.requireProject("alice", 2, "read")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("fails a missing project exactly like a foreign one", async () => {
    const foreign = await guard.requireProject("alice", 2, "read").catch((e) => e);
    const missing = await guard.requireProject("alice", 999, "read").catch((e) => e);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect(missing.message).toBe(foreign.message);
  });

  it("never matches an ownerless project, even with an empty user id", async () => {
    await expect(guard.requireProject("", 3, "read")).rejects.toBeInstanceOf(NotFoundError);
    await expect(guard.requireProject("alice", 3, "read")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects ids that are not positive integers", async () => {
    for (const id of [0, -1, Number.NaN, 1.5]) {
      await expect(guard.requireProject("alice", id, "read")).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});

describe("AccessGuard.requireInProject", () => {
  it("passes a record in the user's project", async () => {
    const record = { id: 10, projectId: 1 };
    await expect(guard.requireInProject("alice", record, "Workflow", "read")).resolves.toBe(record);
  });

  it("refuses a record in another user's project, naming the record", async () => {
    const error = await guard
      .requireInProject("alice", { id: 11, projectId: 2 }, "Workflow", "read")
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe("Workflow not found");
  });

  it("refuses a missing record or one without a project", async () => {
    await expect(guard.requireInProject("alice", null, "Workflow", "read")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      guard.requireInProject("alice", { id: 12, projectId: null }, "Workflow", "read"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("AccessGuard.requireSameProject", () => {
  it("passes a record from the given project", () => {
    const record = { id: 5, projectId: 1 };
    expect(guard.requireSameProject(1, record, "Template")).toBe(record);
  });

  it("refuses a record from a different project", () => {
    expect(() => guard.requireSameProject(1, { id: 6, projectId: 2 }, "Template")).toThrow(NotFoundError);
    expect(() => guard.requireSameProject(1, null, "Template")).toThrow(NotFoundError);
  });
});

describe("AccessGuard.requireUserOwned", () => {
  it("passes the user's own record", () => {
    const record = { id: 7, userId: "alice" };
    expect(guard.requireUserOwned("alice", record, "Provider")).toBe(record);
  });

  it("refuses someone else's, an ownerless one and an empty user id", () => {
    expect(() => guard.requireUserOwned("alice", { id: 8, userId: "bob" }, "Provider")).toThrow(NotFoundError);
    expect(() => guard.requireUserOwned("alice", { id: 9, userId: null }, "Provider")).toThrow(NotFoundError);
    expect(() => guard.requireUserOwned("", { id: 9, userId: null }, "Provider")).toThrow(NotFoundError);
  });
});

describe("AccessGuard with a membership policy", () => {
  // What managed passes: access through organization membership.
  const members = new Map([["acme", new Set(["alice", "bob"])]]);
  const membership: AccessPolicy = {
    async scopeFor(userId) {
      return { userId, organizationId: members.get("acme")!.has(userId) ? "acme" : null };
    },
    async mayAccess(userId, owner) {
      if (owner.organizationId) return members.get(owner.organizationId)?.has(userId) ?? false;
      return ownerAccessPolicy.mayAccess(userId, owner, "write");
    },
  };

  const orgProject: Project = { ...project(10, "alice"), organizationId: "acme" };
  const orgProvider = {
    id: 20, userId: "alice", organizationId: "acme", name: "Shared", type: "RESEND", config: { apiKey: "k" },
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  } as EmailProvider;
  const projectRepo = {
    findById: async (id: number) => (id === 10 ? orgProject : projects.get(id) ?? null),
  };
  const orgGuard = new AccessGuard(projectRepo, membership);

  it("lets a member reach a project another member created", async () => {
    await expect(orgGuard.requireProject("bob", 10, "read")).resolves.toBe(orgProject);
    await expect(
      orgGuard.requireInProject("bob", { id: 5, projectId: 10 }, "Template", "read"),
    ).resolves.toEqual({ id: 5, projectId: 10 });
  });

  it("refuses a non-member the same way as a missing project", async () => {
    await expect(orgGuard.requireProject("carol", 10, "read")).rejects.toThrow(NotFoundError);
    await expect(orgGuard.requireProject("carol", 404, "read")).rejects.toThrow(NotFoundError);
  });

  it("keeps personal projects personal", async () => {
    await expect(orgGuard.requireProject("bob", 1, "read")).rejects.toThrow(NotFoundError);
    await expect(orgGuard.requireProject("alice", 1, "read")).resolves.toMatchObject({ id: 1 });
  });

  it("lets a member use an organization's provider, through the services", async () => {
    const providers = new EmailProviderService(
      { findById: async (id: number) => (id === 20 ? orgProvider : null) } as never,
      orgGuard,
    );
    await expect(providers.requireOwned("bob", 20, "read")).resolves.toBe(orgProvider);
    await expect(providers.requireOwned("carol", 20, "read")).rejects.toThrow(NotFoundError);

    const update = async (_id: number, d: Partial<Project>) => ({ ...orgProject, ...d });
    const service = new ProjectService(
      {
        projects: { ...projectRepo, update } as never,
        providers: { findById: async () => orgProvider },
        aiProviders: { findById: async () => null },
      },
      orgGuard,
    );
    await expect(service.update("bob", 10, { name: "Acme", providerId: "20" })).resolves.toMatchObject({
      providerId: 20,
    });
  });

  it("scopes a member to the organization", async () => {
    await expect(orgGuard.scopeFor("bob")).resolves.toEqual({ userId: "bob", organizationId: "acme" });
    await expect(new AccessGuard(projectRepo).scopeFor("bob")).resolves.toEqual({
      userId: "bob",
      organizationId: null,
    });
  });
});

describe("ownerAccessPolicy", () => {
  it("ignores organizations: the owner is the user in userId", async () => {
    expect(await ownerAccessPolicy.mayAccess("alice", { userId: "alice", organizationId: "acme" }, "read")).toBe(true);
    expect(await ownerAccessPolicy.mayAccess("bob", { userId: "alice", organizationId: "acme" }, "read")).toBe(false);
    expect(await ownerAccessPolicy.mayAccess("", { userId: null }, "read")).toBe(false);
  });
});
