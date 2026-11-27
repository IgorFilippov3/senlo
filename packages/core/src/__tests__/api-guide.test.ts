import { describe, expect, it } from "vitest";
import { apiV1Guide, AUTOMATION_STEP_TYPES, EXAMPLE_PASSWORD_RESET_DESIGN } from "../api-v1/guide";
import { CONTENT_BLOCK_TYPES } from "../blocks/registry";
import { emailDesignDocumentSchema, emailDesignVersion } from "../emailDesign";
import { DESIGN_DOCUMENT_FORMAT, DESIGN_SYSTEM_PROMPT } from "../services/ai/aiDesignService";
import { WORKFLOW_NODE_TYPES } from "../services/workflowService";
import { WorkflowExportSchema } from "../workflow-export";
import { ApiCreateTemplateSchema } from "../api-v1/schemas";

describe("API v1 guide", () => {
  const guide = apiV1Guide();

  it("is built once", () => {
    expect(apiV1Guide()).toBe(guide);
  });

  it("describes the design format with the same words as the AI prompt", () => {
    expect(guide.guide).toContain(DESIGN_DOCUMENT_FORMAT);
    expect(DESIGN_SYSTEM_PROMPT).toContain(DESIGN_DOCUMENT_FORMAT);
    expect(DESIGN_DOCUMENT_FORMAT.startsWith("Row:")).toBe(true);
    expect(guide.designVersion).toBe(emailDesignVersion);
  });

  it("has an example email the create endpoint accepts", () => {
    const parsed = ApiCreateTemplateSchema.safeParse({ ...guide.examples.template });
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(emailDesignDocumentSchema.safeParse(EXAMPLE_PASSWORD_RESET_DESIGN).success).toBe(true);
  });

  it("gives every block type a starting value that passes the schema", () => {
    expect(guide.blocks.map((b) => b.type)).toEqual(CONTENT_BLOCK_TYPES);
    const doc = {
      version: emailDesignVersion,
      settings: {},
      rows: [{ id: "r", type: "row", columns: [{ id: "c", width: 100, blocks: guide.blocks.map((b) => b.example) }] }],
    };
    const parsed = emailDesignDocumentSchema.safeParse(doc);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("documents every automation step type, and only those", () => {
    expect(AUTOMATION_STEP_TYPES.map((s) => s.type).sort()).toEqual([...WORKFLOW_NODE_TYPES].sort());
  });

  it("has example automations in the export format", () => {
    expect(guide.examples.automations.length).toBeGreaterThan(0);
    for (const a of guide.examples.automations) {
      const parsed = WorkflowExportSchema.safeParse(a.workflow);
      expect(parsed.success, a.id).toBe(true);
    }
  });

  it("includes JSON Schemas generated from the zod schemas", () => {
    const design = guide.schemas.emailDesignDocument as { type?: string; properties?: Record<string, unknown> };
    expect(design.type).toBe("object");
    expect(Object.keys(design.properties ?? {})).toEqual(expect.arrayContaining(["version", "rows", "settings"]));
    const exp = guide.schemas.automationExport as { properties?: Record<string, unknown> };
    expect(Object.keys(exp.properties ?? {})).toEqual(expect.arrayContaining(["format", "nodes", "edges"]));
    // Serializable as a response body.
    expect(() => JSON.stringify(guide)).not.toThrow();
  });
});
