import { describe, expect, it, vi } from "vitest";
import { AccessGuard, ownerAccessPolicy, type AccessPolicy } from "../access";
import { ApiIdempotency, IDEMPOTENCY_STALE_MS } from "../api-idempotency";
import { principalFromApiKey, type ApiPrincipal } from "../api-principal";
import { auditActor, isApiCaller } from "../caller";
import {
  IdempotencyInProgressError,
  IdempotencyKeyReusedError,
  NotFoundError,
  PermissionRequiredError,
  ValidationError,
} from "../errors";
import type { Project, User } from "../domain";
import type { IApiIdempotencyRepository, IdempotencyRecord } from "../ports";
import { versionSource } from "../services/emailTemplateService";

const project = (id: number, userId: string, organizationId: string | null = null) =>
  ({ id, userId, organizationId, name: `p${id}`, createdAt: new Date(), updatedAt: new Date() }) as Project;
const p7 = project(7, "alice");
const p8 = project(8, "bob");
const projects = { findById: async (id: number) => [p7, p8].find((p) => p.id === id) ?? null };
const users = {
  findById: async (id: string) =>
    id === "alice" ? ({ id, email: "Alice@Example.com", name: "Alice", image: null, passwordHash: null } as User) : null,
};

const manager = (client: string | null = null): ApiPrincipal =>
  principalFromApiKey({ id: 3, projectId: 7, permissions: ["manage"] }, client);
const sender: ApiPrincipal = principalFromApiKey({ id: 4, projectId: 7, permissions: ["send"] }, null);

describe("Caller", () => {
  it("tells a principal from a user id and names each in the audit log", () => {
    expect(isApiCaller("alice")).toBe(false);
    expect(isApiCaller(manager())).toBe(true);
    expect(auditActor("alice")).toEqual({ userId: "alice" });
    expect(auditActor(manager("mcp/1.0.0"))).toEqual({ apiKeyId: 3, client: "mcp/1.0.0" });
  });

  it("marks a version by where it came from", () => {
    expect(versionSource("alice")).toBe("editor");
    expect(versionSource(manager())).toBe("api");
    expect(versionSource(manager("curl/8"))).toBe("api");
    expect(versionSource(manager("MCP/1.0.0"))).toBe("mcp");
  });
});

describe("AccessGuard with an API principal", () => {
  const guard = new AccessGuard(projects, ownerAccessPolicy, users);

  it("reaches its own project only", async () => {
    expect((await guard.requireProject(manager(), 7, "write")).id).toBe(7);
    await expect(guard.requireProject(manager(), 8, "read")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("needs manage, even for reading", async () => {
    await expect(guard.requireProject(sender, 7, "read")).rejects.toBeInstanceOf(PermissionRequiredError);
  });

  it("reaches a record inside its project only", async () => {
    expect(await guard.requireInProject(manager(), { projectId: 7, id: 1 }, "Template", "write")).toEqual({ projectId: 7, id: 1 });
    await expect(guard.requireInProject(manager(), { projectId: 8 }, "Template", "read")).rejects.toBeInstanceOf(NotFoundError);
    await expect(guard.requireInProject(manager(), null, "Template", "read")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reads, never writes, a record its project's owner owns", async () => {
    const provider = { userId: "alice", organizationId: null };
    expect(await guard.requireOwned(manager(), provider, "Email provider", "read")).toBe(provider);
    await expect(guard.requireOwned(manager(), provider, "Email provider", "write")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      guard.requireOwned(manager(), { userId: "bob", organizationId: null }, "Email provider", "read"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("matches an organization's records by organization", async () => {
    const orgProject = project(9, "alice", "acme");
    const g = new AccessGuard({ findById: async () => orgProject }, ownerAccessPolicy);
    const principal = principalFromApiKey({ id: 1, projectId: 9, permissions: ["manage"] }, null);
    const shared = { userId: "someone-else", organizationId: "acme" };
    expect(await g.requireOwned(principal, shared, "Email provider", "read")).toBe(shared);
    await expect(
      g.requireOwned(principal, { userId: "alice", organizationId: "other" }, "Email provider", "read"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("leaves user callers to the policy as before", async () => {
    expect((await guard.requireProject("alice", 7, "write")).id).toBe(7);
    await expect(guard.requireProject("alice", 8, "read")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("AccessGuard.testRecipients", () => {
  it("defaults to the project owner's address, lowercased", async () => {
    const guard = new AccessGuard(projects, ownerAccessPolicy, users);
    expect(await guard.testRecipients(p7)).toEqual(["alice@example.com"]);
    expect(await guard.testRecipients(p8)).toEqual([]);
    expect(await new AccessGuard(projects).testRecipients(p7)).toEqual([]);
  });

  it("takes the policy's list when it has one", async () => {
    const policy: AccessPolicy = { ...ownerAccessPolicy, testRecipients: async () => [" Ed@Acme.io ", ""] };
    expect(await new AccessGuard(projects, policy, users).testRecipients(p7)).toEqual(["ed@acme.io"]);
  });
});

/** An in-memory key store with the real one's claim rule. */
function idempotencyRepo() {
  const rows = new Map<string, IdempotencyRecord & { projectId: number; key: string }>();
  let nextId = 1;
  const repo: IApiIdempotencyRepository = {
    claim: vi.fn(async (data, expiredBefore) => {
      for (const [k, r] of rows) if (r.projectId === data.projectId && r.createdAt < expiredBefore) rows.delete(k);
      const id = `${data.projectId}:${data.key}`;
      const existing = rows.get(id);
      if (existing) return { claimed: false as const, record: existing };
      const row = { ...data, id: nextId++, statusCode: null, response: null, createdAt: new Date(clock.now) };
      rows.set(id, row);
      return { claimed: true as const, id: row.id };
    }),
    complete: vi.fn(async (id, statusCode, response) => {
      for (const r of rows.values()) if (r.id === id) Object.assign(r, { statusCode, response });
    }),
    release: vi.fn(async (id) => {
      for (const [k, r] of rows) if (r.id === id) rows.delete(k);
    }),
  };
  return { repo, rows };
}
const clock = { now: Date.parse("2026-11-27T10:00:00Z") };

describe("ApiIdempotency", () => {
  const setup = () => {
    const { repo, rows } = idempotencyRepo();
    return { idem: new ApiIdempotency(repo, () => clock.now), repo, rows };
  };
  const op = "POST /api/v1/templates";

  it("runs the first request, then replays its answer for the same key and body", async () => {
    const { idem } = setup();
    const first = await idem.begin(7, "k1", op, { name: "A", n: [1, 2] });
    expect(first).toEqual({ run: true, id: 1 });
    await idem.complete(1, 201, { data: { id: 5 } });

    // Same body, keys in another order: the same request.
    expect(await idem.begin(7, "k1", op, { n: [1, 2], name: "A" })).toEqual({ run: false, status: 201, body: { data: { id: 5 } } });
  });

  it("refuses the key for another body or another operation", async () => {
    const { idem } = setup();
    await idem.begin(7, "k1", op, { name: "A" });
    await idem.complete(1, 201, {});
    await expect(idem.begin(7, "k1", op, { name: "B" })).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
    await expect(idem.begin(7, "k1", "POST /api/v1/triggers", { name: "A" })).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
  });

  it("keeps keys per project", async () => {
    const { idem } = setup();
    await idem.begin(7, "k1", op, { name: "A" });
    expect((await idem.begin(8, "k1", op, { name: "B" })).run).toBe(true);
  });

  it("answers a retry of a request still running with 409, and takes over one that died", async () => {
    const { idem, repo } = setup();
    await idem.begin(7, "k1", op, {});
    await expect(idem.begin(7, "k1", op, {})).rejects.toBeInstanceOf(IdempotencyInProgressError);

    clock.now += IDEMPOTENCY_STALE_MS + 1;
    expect((await idem.begin(7, "k1", op, {})).run).toBe(true);
    expect(repo.release).toHaveBeenCalledWith(1);
  });

  it("runs again after a release (the first try failed)", async () => {
    const { idem } = setup();
    const first = await idem.begin(7, "k1", op, { name: "A" });
    if (first.run) await idem.release(first.id);
    expect((await idem.begin(7, "k1", op, { name: "A" })).run).toBe(true);
  });

  it("forgets a key after a day", async () => {
    const { idem } = setup();
    await idem.begin(7, "k1", op, { name: "A" });
    await idem.complete(1, 201, {});
    clock.now += 24 * 60 * 60 * 1000 + 1;
    expect((await idem.begin(7, "k1", op, { name: "B" })).run).toBe(true);
  });

  it("refuses an empty or overlong key", async () => {
    const { idem } = setup();
    await expect(idem.begin(7, "  ", op, {})).rejects.toBeInstanceOf(ValidationError);
    await expect(idem.begin(7, "x".repeat(256), op, {})).rejects.toBeInstanceOf(ValidationError);
  });
});
