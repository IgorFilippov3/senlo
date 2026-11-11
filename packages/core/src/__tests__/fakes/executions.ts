import { vi } from "vitest";
import type { WorkflowExecution, WorkflowRunSummary, WorkflowStepExecution } from "../../domain";
import type { CompleteStep, IWorkflowExecutionRepository, NewWorkflowExecution, WorkflowRunFilter } from "../../ports";

const summary = (r: WorkflowExecution): WorkflowRunSummary => ({
  id: r.id,
  workflowId: r.workflowId,
  contactId: r.contactId,
  contactEmail: null,
  status: r.status,
  exitReason: r.exitReason ?? null,
  currentNodeId: r.currentNodeId,
  isTest: r.isTest ?? false,
  versionId: r.versionId,
  startedAt: r.startedAt,
  completedAt: r.completedAt ?? null,
});

/**
 * An in-memory `IWorkflowExecutionRepository` with the same guards as the
 * database one: one RUNNING run per contact and workflow, cursor moves and
 * ends only from the expected state, one step row per run and step.
 */
export function fakeExecutions({ lifecycleVersions = [] as number[] } = {}) {
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
        (r) => r.workflowId === d.workflowId && r.contactId === d.contactId && r.status === "RUNNING" && !r.isTest,
      );
      if (taken && !d.isTest) return null;
      const run: WorkflowExecution = {
        ...d,
        isTest: d.isTest ?? false,
        generation: 0,
        goalEvent: d.goalEvent ?? null,
        waitingEvent: null,
        id: runs.size + 1,
        status: "RUNNING",
        startedAt: new Date(),
        wakeAt: new Date(),
      };
      runs.set(run.id, run);
      return run;
    }),
    findById: async (id: number) => runs.get(id) ?? null,
    findRunningByContact: async (workflowId: number, contactId: number) =>
      [...runs.values()].find(
        (r) => r.workflowId === workflowId && r.contactId === contactId && r.status === "RUNNING" && !r.isTest,
      ) ?? null,
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
        runs.set(id, { ...run, status: e.status, exitReason: e.exitReason, completedAt: new Date(), wakeAt: null, waitingEvent: null });
        return true;
      },
    ),
    claimStep: vi.fn(async (executionId: number, nodeId: string, generation = 0) => {
      const key = generation > 0 ? `${executionId}:${nodeId}:g${generation}` : `${executionId}:${nodeId}`;
      const existing = steps.get(key);
      if (existing) return existing;
      const row: WorkflowStepExecution = {
        id: ++stepIds,
        executionId,
        nodeId,
        generation,
        status: "PENDING",
        startedAt: new Date(),
      };
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
        .map((r) => ({ id: r.id, currentNodeId: r.currentNodeId!, generation: r.generation ?? 0 })),
    ),
    findWaiting: vi.fn(async (contactId: number, eventName: string) =>
      [...runs.values()].filter((r) => r.contactId === contactId && r.status === "RUNNING" && r.waitingEvent === eventName),
    ),
    findByGoal: vi.fn(async (contactId: number, eventName: string) =>
      [...runs.values()].filter((r) => r.contactId === contactId && r.status === "RUNNING" && r.goalEvent === eventName),
    ),
    startWait: vi.fn(async (id: number, w: { nodeId: string; event: string; wakeAt: Date }) => {
      const run = runs.get(id);
      if (!run || run.status !== "RUNNING" || run.currentNodeId !== w.nodeId || run.waitingEvent) return false;
      runs.set(id, { ...run, waitingEvent: w.event, wakeAt: w.wakeAt });
      return true;
    }),
    resolveWait: vi.fn(async (id: number, w: { nodeId: string; event: string }) => {
      const run = runs.get(id);
      if (!run || run.status !== "RUNNING" || run.currentNodeId !== w.nodeId || run.waitingEvent !== w.event) return false;
      runs.set(id, { ...run, waitingEvent: null });
      return true;
    }),
    restart: vi.fn(
      async (
        id: number,
        d: { versionId: number; context: WorkflowExecution["context"]; currentNodeId: string; goalEvent: string | null },
      ) => {
        const run = runs.get(id);
        if (!run || run.status !== "RUNNING") return null;
        const next: WorkflowExecution = {
          ...run,
          ...d,
          generation: (run.generation ?? 0) + 1,
          waitingEvent: null,
          wakeAt: new Date(),
          startedAt: new Date(),
        };
        runs.set(id, next);
        return next;
      },
    ),
    cancel: vi.fn(async (id: number, exitReason: string) => {
      const run = runs.get(id);
      if (!run || run.status !== "RUNNING") return false;
      runs.set(id, { ...run, status: "CANCELLED", exitReason, completedAt: new Date(), wakeAt: null, waitingEvent: null });
      return true;
    }),
    listRuns: vi.fn(async (workflowId: number, f: WorkflowRunFilter) =>
      [...runs.values()]
        .filter(
          (r) =>
            r.workflowId === workflowId &&
            (f.includeTests || !r.isTest) &&
            (f.status === undefined || r.status === f.status) &&
            (f.contactId === undefined || r.contactId === f.contactId) &&
            (f.beforeId === undefined || r.id < f.beforeId),
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, f.limit)
        .map(summary),
    ),
    listContactRuns: vi.fn(async (contactId: number, limit: number) =>
      [...runs.values()]
        .filter((r) => r.contactId === contactId)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
        .map(summary),
    ),
    setStepOutput: vi.fn(async (id: number, nodeId: string, output: unknown) => {
      const run = runs.get(id);
      if (run) runs.set(id, { ...run, context: { ...run.context, steps: { ...run.context.steps, [nodeId]: output } } });
    }),
    cancelRunning: vi.fn(async (contactId: number, o: { workflowId?: number; exitReason: string; lifecycleOnly?: boolean }) => {
      const ids: number[] = [];
      for (const run of runs.values()) {
        if (run.contactId !== contactId || run.status !== "RUNNING") continue;
        if (o.workflowId !== undefined && run.workflowId !== o.workflowId) continue;
        if (o.lifecycleOnly && !lifecycleVersions.includes(run.versionId ?? -1)) continue;
        runs.set(run.id, { ...run, status: "CANCELLED", exitReason: o.exitReason, wakeAt: null });
        ids.push(run.id);
      }
      return ids;
    }),
    getStepExecutions: async (executionId: number, generation?: number) =>
      [...steps.values()].filter(
        (s) => s.executionId === executionId && (generation === undefined || (s.generation ?? 0) === generation),
      ),
    getNodeStats: async () => [],
    lastStartedAt: vi.fn(async (workflowId: number, contactId: number) => {
      const starts = [...runs.values()]
        .filter((r) => r.workflowId === workflowId && r.contactId === contactId && !r.isTest)
        .map((r) => r.startedAt.getTime());
      return starts.length > 0 ? new Date(Math.max(...starts)) : null;
    }),
    getRunStats: async () => ({ started: 0, running: 0, completed: 0, goal: 0, failed: 0, cancelled: 0 }),
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
