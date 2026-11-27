import { describe, it, expect, vi } from "vitest";
import { AuthService } from "../services/authService";
import { NotFoundError } from "../errors";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../api-key";
import type { ApiKey } from "../domain";

const hashed: ApiKey & { keyHash: string } = {
  id: 1, projectId: 1, name: "new", prefix: "snl_newnewne", permissions: ["send", "manage"], keyHash: hashApiKey("snl_newnewnew"), createdAt: new Date(),
};
const legacy: ApiKey & { key: string } = {
  id: 2, projectId: 1, name: "old", prefix: "old-plain-ke", permissions: ["send"], key: "old-plain-key", createdAt: new Date(),
};

function repo() {
  return {
    findByHash: vi.fn(async (h: string) => (h === hashed.keyHash ? hashed : null)),
    findLegacyByKey: vi.fn(async (k: string) => (k === legacy.key ? legacy : null)),
    findByProject: async () => [],
    findById: async () => null,
    create: async () => hashed,
    updateLastUsed: vi.fn(async () => {}),
    delete: async () => {},
  };
}

const project = { id: 1, name: "My app", createdAt: new Date(), updatedAt: new Date() };
const projects = { findById: vi.fn(async (id: number) => (id === 1 ? project : null)) };

describe("API key hashing", () => {
  it("hashes deterministically and keeps a 12-character prefix", () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toContain(key.slice(4, 12));
    expect(apiKeyPrefix(key)).toBe(key.slice(0, 12));
    expect(apiKeyPrefix(key)).toMatch(/^snl_[a-z2-7]{8}$/);
  });
});

describe("AuthService.validateApiKey", () => {
  it("matches a hashed key by its hash and touches lastUsedAt", async () => {
    const r = repo();
    const service = new AuthService(r, projects);
    expect(await service.validateApiKey("snl_newnewnew")).toBe(hashed);
    expect(r.findLegacyByKey).not.toHaveBeenCalled();
    expect(r.updateLastUsed).toHaveBeenCalledWith(1);
  });

  it("still accepts a key stored in the clear from before hashing", async () => {
    const r = repo();
    expect(await new AuthService(r, projects).validateApiKey("old-plain-key")).toBe(legacy);
    expect(r.findByHash).toHaveBeenCalledWith(hashApiKey("old-plain-key"));
  });

  it("rejects an unknown key and a near miss", async () => {
    const service = new AuthService(repo(), projects);
    expect(await service.validateApiKey("snl_newnewnex")).toBeNull();
    expect(await service.validateApiKey("")).toBeNull();
  });
});

describe("AuthService.resolvePrincipal", () => {
  it("turns a key into a principal of its project, with its permissions and the client label", async () => {
    const service = new AuthService(repo(), projects);
    expect(await service.resolvePrincipal("snl_newnewnew", "mcp/1.0.0")).toEqual({
      projectId: 1,
      permissions: ["send", "manage"],
      source: "api_key",
      actor: { apiKeyId: 1 },
      client: "mcp/1.0.0",
    });
  });

  it("returns null for an unknown key", async () => {
    expect(await new AuthService(repo(), projects).resolvePrincipal("snl_nope", null)).toBeNull();
  });
});

describe("AuthService.describePrincipal", () => {
  const principal = {
    projectId: 1,
    permissions: ["send", "manage"] as const,
    source: "api_key" as const,
    actor: { apiKeyId: 1 },
    client: null,
  };

  it("shows the project, permissions and the key without its secret", async () => {
    const r = { ...repo(), findById: vi.fn(async () => hashed) };
    const me = await new AuthService(r, projects).describePrincipal(principal);
    expect(me).toEqual({
      project: { id: 1, name: "My app" },
      permissions: ["send", "manage"],
      auth: { source: "api_key", apiKey: { id: 1, name: "new", prefix: "snl_newnewne" }, client: null },
    });
    expect(JSON.stringify(me)).not.toContain(hashed.keyHash);
  });

  it("is a 404 when the key's project is gone", async () => {
    await expect(
      new AuthService(repo(), projects).describePrincipal({ ...principal, projectId: 99 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
