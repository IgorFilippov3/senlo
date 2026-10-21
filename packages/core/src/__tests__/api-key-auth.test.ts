import { describe, it, expect, vi } from "vitest";
import { AuthService } from "../services/authService";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../api-key";
import type { ApiKey } from "../domain";

const hashed: ApiKey & { keyHash: string } = {
  id: 1, projectId: 1, name: "new", prefix: "snl_newnewne", keyHash: hashApiKey("snl_newnewnew"), createdAt: new Date(),
};
const legacy: ApiKey & { key: string } = {
  id: 2, projectId: 1, name: "old", prefix: "old-plain-ke", key: "old-plain-key", createdAt: new Date(),
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
    const service = new AuthService(r);
    expect(await service.validateApiKey("snl_newnewnew")).toBe(hashed);
    expect(r.findLegacyByKey).not.toHaveBeenCalled();
    expect(r.updateLastUsed).toHaveBeenCalledWith(1);
  });

  it("still accepts a key stored in the clear from before hashing", async () => {
    const r = repo();
    expect(await new AuthService(r).validateApiKey("old-plain-key")).toBe(legacy);
    expect(r.findByHash).toHaveBeenCalledWith(hashApiKey("old-plain-key"));
  });

  it("rejects an unknown key and a near miss", async () => {
    const service = new AuthService(repo());
    expect(await service.validateApiKey("snl_newnewnex")).toBeNull();
    expect(await service.validateApiKey("")).toBeNull();
  });
});
