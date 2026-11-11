import { describe, expect, it } from "vitest";
import { WORKFLOW_TEMPLATES, WORKFLOW_TEMPLATE_CATEGORIES, findWorkflowTemplate } from "../workflow-templates";
import { exportEmailRefs, instantiateWorkflowExport, parseWorkflowExport } from "../workflow-export";
import { validateWorkflowGraph } from "../workflow-graph";
import { validateWorkflowSettings } from "../workflow-settings";
import { WORKFLOW_NODE_TYPES } from "../services/workflowService";

const graphOf = (nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>, edges: Array<{ source: string; target: string; sourceHandle: string | null }>) =>
  validateWorkflowGraph(nodes, edges);

describe("template gallery", () => {
  it("has the 14 reference flows with unique ids, in known categories, some popular", () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(14);
    expect(new Set(WORKFLOW_TEMPLATES.map((t) => t.id)).size).toBe(14);
    const categories = WORKFLOW_TEMPLATE_CATEGORIES.map((c) => c.id);
    for (const t of WORKFLOW_TEMPLATES) expect(categories).toContain(t.category);
    expect(WORKFLOW_TEMPLATES.filter((t) => t.popular).length).toBeGreaterThanOrEqual(3);
    expect(findWorkflowTemplate("trial-ending")?.name).toBe("Trial ending");
    expect(findWorkflowTemplate("digest")).toBeUndefined();
  });

  for (const template of WORKFLOW_TEMPLATES) {
    it(`${template.id}: a valid export that only needs its emails chosen to go live`, () => {
      const parsed = parseWorkflowExport(template.workflow);
      expect(parsed.success).toBe(true);
      expect(validateWorkflowSettings(template.workflow.settings)).toEqual([]);
      for (const node of template.workflow.nodes) expect(WORKFLOW_NODE_TYPES as readonly string[]).toContain(node.type);

      // Its trigger is the event it lists as the trigger; its goal is listed too.
      const trigger = template.workflow.nodes.find((n) => n.type === "trigger")!;
      expect(template.events.find((e) => e.role === "trigger")?.name).toBe(trigger.data.event);
      const goal = template.workflow.settings.goal?.event;
      if (goal) expect(template.events.some((e) => e.name === goal && e.role === "goal")).toBe(true);

      // As created: only the email steps are missing.
      const empty = instantiateWorkflowExport(template.workflow, new Map(), (() => { let i = 0; return () => `n${++i}`; })());
      const before = graphOf(empty.nodes, empty.edges);
      expect(before).toEqual({ valid: false, reasons: ["Choose the email for every Send email step."] });

      // With every email chosen it can go live.
      const refs = exportEmailRefs(template.workflow);
      expect(refs.length).toBeGreaterThan(0);
      const chosen = instantiateWorkflowExport(template.workflow, new Map(refs.map((r) => [r, 1])), (() => { let i = 0; return () => `n${++i}`; })());
      expect(graphOf(chosen.nodes, chosen.edges)).toEqual({ valid: true });
    });
  }
});
