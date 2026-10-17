import { describe, it, expect } from "vitest";
import { AccessGuard } from "../access";
import { NotFoundError } from "../errors";
import type { Project } from "../domain";

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
    await expect(guard.requireProject("alice", 1)).resolves.toMatchObject({ id: 1 });
  });

  it("refuses another user's project", async () => {
    await expect(guard.requireProject("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("fails a missing project exactly like a foreign one", async () => {
    const foreign = await guard.requireProject("alice", 2).catch((e) => e);
    const missing = await guard.requireProject("alice", 999).catch((e) => e);
    expect(missing).toBeInstanceOf(NotFoundError);
    expect(missing.message).toBe(foreign.message);
  });

  it("never matches an ownerless project, even with an empty user id", async () => {
    await expect(guard.requireProject("", 3)).rejects.toBeInstanceOf(NotFoundError);
    await expect(guard.requireProject("alice", 3)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects ids that are not positive integers", async () => {
    for (const id of [0, -1, Number.NaN, 1.5]) {
      await expect(guard.requireProject("alice", id)).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});

describe("AccessGuard.requireInProject", () => {
  it("passes a record in the user's project", async () => {
    const record = { id: 10, projectId: 1 };
    await expect(guard.requireInProject("alice", record, "Workflow")).resolves.toBe(record);
  });

  it("refuses a record in another user's project, naming the record", async () => {
    const error = await guard
      .requireInProject("alice", { id: 11, projectId: 2 }, "Workflow")
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe("Workflow not found");
  });

  it("refuses a missing record or one without a project", async () => {
    await expect(guard.requireInProject("alice", null, "Workflow")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      guard.requireInProject("alice", { id: 12, projectId: null }, "Workflow"),
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
