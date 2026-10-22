import { describe, it, expect, vi } from "vitest";
import { AiProviderService, DEFAULT_AI_MODELS } from "../services/ai/aiProviderService";
import { AiDesignService, DESIGN_SYSTEM_PROMPT } from "../services/ai/aiDesignService";
import type { JsonCompletionClient } from "../services/ai/completion";
import { AppError, FormValidationError, NotFoundError, ValidationError } from "../errors";
import type { AiProvider, Project } from "../domain";

const alice = { id: 1, userId: "alice", name: "A", aiProviderId: 10, createdAt: new Date(), updatedAt: new Date() } as Project;
const bob = { id: 2, userId: "bob", name: "B", aiProviderId: 10, createdAt: new Date(), updatedAt: new Date() } as Project;
const noAi = { id: 3, userId: "alice", name: "C", aiProviderId: null, createdAt: new Date(), updatedAt: new Date() } as Project;
const projects = { findById: async (id: number) => [alice, bob, noAi].find((p) => p.id === id) ?? null };

const openai: AiProvider = { id: 10, userId: "alice", name: "o", type: "OPENAI", isActive: true, config: { apiKey: "sk", model: "gpt-x" }, createdAt: new Date(), updatedAt: new Date() };
const anthropic: AiProvider = { ...openai, id: 11, type: "ANTHROPIC" };

function aiRepo(seed: AiProvider[]) {
  const rows = new Map(seed.map((p) => [p.id, p]));
  return {
    rows,
    findById: async (id: number) => rows.get(id) ?? null,
    listForUser: async (u: string) => [...rows.values()].filter((p) => p.userId === u),
    listForOrganization: async (o: string) => [...rows.values()].filter((p) => p.organizationId === o),
    create: async (d: Omit<AiProvider, "id" | "createdAt" | "updatedAt">) => {
      const p = { ...d, id: 99, createdAt: new Date(), updatedAt: new Date() };
      rows.set(99, p);
      return p;
    },
    update: async (id: number, d: Partial<AiProvider>) => (rows.has(id) ? { ...rows.get(id)!, ...d } : null),
    delete: async (id: number) => { rows.delete(id); },
  };
}

const validDesign = { rows: [], settings: {} };

describe("AiProviderService", () => {
  it("fills the default model per type", async () => {
    const repo = aiRepo([]);
    const s = new AiProviderService(repo);
    await s.create("alice", { name: "x", type: "OPENAI", apiKey: "k", model: "" });
    expect(repo.rows.get(99)!.config).toEqual({ apiKey: "k", model: DEFAULT_AI_MODELS.OPENAI });
    const q = await s.create("alice", { name: "x", type: "ANTHROPIC", apiKey: "k", model: "claude-y" });
    expect(q.config.model).toBe("claude-y");
  });

  it("never hands the API key back, only whether one is set", async () => {
    const s = new AiProviderService(aiRepo([openai]));
    const [listed] = await s.listForUser("alice");
    expect(listed.config).toEqual({ model: "gpt-x" });
    expect(listed.secretsSet).toEqual(["apiKey"]);
    const created = await s.create("alice", { name: "x", type: "OPENAI", apiKey: "k" });
    expect(JSON.stringify(created)).not.toContain('"k"');
    expect(JSON.stringify(await s.setActive("alice", 10, false))).not.toContain("sk");
    expect((await s.requireOwned("alice", 10)).config.apiKey).toBe("sk");
  });

  it("rejects invalid input as field errors", async () => {
    const s = new AiProviderService(aiRepo([]));
    const e = await s.create("alice", { name: "", type: "GEMINI", apiKey: "" }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(Object.keys(e.fieldErrors).sort()).toEqual(["apiKey", "name", "type"]);
  });

  it("refuses another user's provider like a missing one", async () => {
    const s = new AiProviderService(aiRepo([openai]));
    await expect(s.setActive("bob", 10, false)).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.delete("bob", 10)).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.delete("alice", 5)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("AiDesignService.generate", () => {
  const client = (answer: string | (() => string)) => {
    const completeJson = vi.fn(
      async (_options: Parameters<JsonCompletionClient["completeJson"]>[0]) =>
        typeof answer === "string" ? answer : answer(),
    );
    const c: JsonCompletionClient = { type: "OPENAI", completeJson };
    return { c, completeJson };
  };

  it("validates the request body", async () => {
    const s = new AiDesignService(projects, aiRepo([openai]), [client("{}").c]);
    const e = await s.generate("alice", { prompt: "", projectId: 1 }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(e.fieldErrors.prompt).toEqual(["Prompt is required"]);
    await expect(s.generate("alice", { prompt: "hi" })).rejects.toBeInstanceOf(FormValidationError);
  });

  it("refuses another user's project", async () => {
    const s = new AiDesignService(projects, aiRepo([openai]), [client("{}").c]);
    await expect(s.generate("alice", { prompt: "hi", projectId: 2 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("needs a configured, known provider", async () => {
    const s = new AiDesignService(projects, aiRepo([]), [client("{}").c]);
    await expect(s.generate("alice", { prompt: "hi", projectId: 3 })).rejects.toBeInstanceOf(ValidationError);
    await expect(s.generate("alice", { prompt: "hi", projectId: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("answers 501 for a provider type without a client", async () => {
    const s = new AiDesignService(projects, aiRepo([{ ...anthropic, id: 10 }]), [client("{}").c]);
    const e = await s.generate("alice", { prompt: "hi", projectId: 1 }).catch((x) => x);
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(501);
  });

  it("sends the system prompt, the edit prompt when a design has rows, then the user prompt", async () => {
    const { c, completeJson } = client(JSON.stringify(validDesign));
    const s = new AiDesignService(projects, aiRepo([openai]), [c]);
    await s.generate("alice", { prompt: "make it blue", projectId: "1", currentDesign: { rows: [{}] } });
    const call = completeJson.mock.calls[0][0] as any;
    expect(call.apiKey).toBe("sk");
    expect(call.model).toBe("gpt-x");
    expect(call.messages.map((m: any) => m.role)).toEqual(["system", "system", "user"]);
    expect(call.messages[0].content).toBe(DESIGN_SYSTEM_PROMPT);
    expect(call.messages[1].content).toContain("EDIT mode");
    expect(call.messages[2].content).toBe("make it blue");

    await s.generate("alice", { prompt: "new", projectId: 1, currentDesign: { rows: [] } });
    expect((completeJson.mock.calls[1][0] as any).messages).toHaveLength(2);
  });

  it("returns the validated design and refuses anything else with 422", async () => {
    const good = new AiDesignService(projects, aiRepo([openai]), [client(JSON.stringify(validDesign)).c]);
    await expect(good.generate("alice", { prompt: "x", projectId: 1 })).resolves.toMatchObject({ rows: [] });

    const notJson = new AiDesignService(projects, aiRepo([openai]), [client("nope").c]);
    const e1 = await notJson.generate("alice", { prompt: "x", projectId: 1 }).catch((x) => x);
    expect(e1.statusCode).toBe(422);

    const wrongShape = new AiDesignService(projects, aiRepo([openai]), [client('{"rows": "x"}').c]);
    const e2 = await wrongShape.generate("alice", { prompt: "x", projectId: 1 }).catch((x) => x);
    expect(e2.statusCode).toBe(422);
    expect(e2.details.details).toBeInstanceOf(Array);
  });
});
