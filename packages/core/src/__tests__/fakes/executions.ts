import { vi } from "vitest";
import type { WorkflowExecution, WorkflowStepExecution } from "../../domain";
import type { CompleteStep, IWorkflowExecutionRepository, NewWorkflowExecution } from "../../ports";

/**
 * An in-memory `IWorkflowExecutionRepository` with the same guards as the
 * database one: one RUNNING run per contact and workflow, cursor moves and
 * ends only from the expected state, one step row per run and step.
 */
export function fakeExecutions() {
  const runs = new Map<number, WorkflowExecution>();
  const steps = new Map<string, WorkflowStepExecution>();
  let stepIds = 0;

  const complete = (step?: CompleteStep) => {
    if (!step) return;
    for (const [key, row] of steps) {
      if (row.id === step.id) {
        steps.set(key, {
          ...row,
          status: step.status ?? "COMPLETED",
          completedAt: new Date(),
          ...(step.result !== undefined ? { result: step.result } : {}),
        });
      }
    }
  };

  const repo = {
    create: vi.fn(async (d: NewWorkflowExecution) => {
      const taken = [...runs.values()].some(
        (r) => r.workflowId === d.workflowId && r.contactId === d.contactId && r.status === "RUNNING",
      );
      if (taken) return null;
      const run: WorkflowExecution = { ...d, id: runs.size + 1, status: "RUNNING", startedAt: new Date(), wakeAt: new Date() };
      runs.set(run.id, run);
      return run;
    }),
    findById: async (id: number) => runs.get(id) ?? null,
    findRunningByContact: async (workflowId: number, contactId: number) =>
      [...runs.values()].find((r) => r.workflowId === workflowId && r.contactId === contactId && r.status === "RUNNING") ?? null,
    moveCursor: vi.fn(async (id: number, m: { from: string; to: string; wakeAt: Date; completeStep?: CompleteStep }) => {
      complete(m.completeStep);
      const run = runs.get(id);
      if (!run || run.status !== "RUNNING" || run.currentNodeId !== m.from) return false;
      runs.set(id, { ...run, currentNodeId: m.to, wakeAt: m.wakeAt });
      return true;
    }),
    finish: vi.fn(
      async (
        id: number,
        e: { status: Exclude<WorkflowExecution["status"], "RUNNING">; exitReason: string; from?: string; completeStep?: CompleteStep },
      ) => {
        complete(e.completeStep);
        const run = runs.get(id);
        if (!run || run.status !== "RUNNING" || (e.from !== undefined && run.currentNodeId !== e.from)) return false;
        runs.set(id, { ...run, status: e.status, exitReason: e.exitReason, completedAt: new Date(), wakeAt: null });
        return true;
      },
    ),
    claimStep: vi.fn(async (executionId: number, nodeId: string) => {
      const key = `${executionId}:${nodeId}`;
      const existing = steps.get(key);
      if (existing) return existing;
      const row: WorkflowStepExecution = { id: ++stepIds, executionId, nodeId, status: "PENDING", startedAt: new Date() };
      steps.set(key, row);
      return row;
    }),
    updateStepExecution: vi.fn(async (id: number, data: Partial<WorkflowStepExecution>) => {
      for (const [key, row] of steps) if (row.id === id) steps.set(key, { ...row, ...data });
    }),
    findDue: vi.fn(async (before: Date, limit: number) =>
      [...runs.values()]
        .filter((r) => r.status === "RUNNING" && r.currentNodeId && r.wakeAt && r.wakeAt < before)
        .sort((a, b) => a.wakeAt!.getTime() - b.wakeAt!.getTime())
        .slice(0, limit)
        .map((r) => ({ id: r.id, currentNodeId: r.currentNodeId! })),
    ),
    cancelRunning: vi.fn(async (contactId: number, o: { workflowId?: number; exitReason: string }) => {
      const ids: number[] = [];
      for (const run of runs.values()) {
        if (run.contactId !== contactId || run.status !== "RUNNING") continue;
        if (o.workflowId !== undefined && run.workflowId !== o.workflowId) continue;
        runs.set(run.id, { ...run, status: "CANCELLED", exitReason: o.exitReason, wakeAt: null });
        ids.push(run.id);
      }
      return ids;
    }),
    getStepExecutions: async (executionId: number) => [...steps.values()].filter((s) => s.executionId === executionId),
    getNodeStats: async () => [],
  } satisfies IWorkflowExecutionRepository;

  /** A run put in place by hand, as an old row or another process would leave it. */
  const seed = (run: Partial<WorkflowExecution> & { id: number }) =>
    runs.set(run.id, {
      workflowId: 10,
      contactId: 3,
      status: "RUNNING",
      versionId: 1,
      context: { steps: {} },
      currentNodeId: null,
      startedAt: new Date(),
      ...run,
    });

  return { repo, runs, steps, seed };
}
