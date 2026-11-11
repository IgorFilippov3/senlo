"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActionResult, Workflow, WorkflowSettings } from "@senlo/core";
import type { RunsFilter } from "./actions";
import { useSenloActions } from "./provider";
import { queryKeys } from "./query-keys";
import { unwrap } from "./result";

/** The server refused to activate: `reasons` lists what to fix in the graph. */
export class WorkflowNotReadyError extends Error {
  constructor(readonly reasons: string[]) {
    super("This automation cannot go live yet.");
  }
}

/** Like `unwrap`, but keeps go-live reasons and per-node save errors readable. */
function unwrapWorkflow<T>(result: ActionResult<T>): T {
  if (result.success) return result.data;
  const details = result.error.details ?? {};
  if (Array.isArray(details.reasons)) throw new WorkflowNotReadyError(details.reasons);
  const fieldErrors = details.fieldErrors as Record<string, string[] | undefined> | undefined;
  const first = fieldErrors && Object.values(fieldErrors).find((list) => list?.[0])?.[0];
  throw new Error(first ?? result.error.message);
}

export function useProjectWorkflows(projectId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.workflows.byProject(projectId),
    queryFn: async () => unwrap(await actions.workflows.list(projectId)),
    enabled: !!projectId,
  });
}

export function useWorkflowStats(
  workflowId: number,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.workflows.stats(workflowId),
    queryFn: async () => unwrap(await actions.workflows.stats(workflowId)),
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}

/** Saves goal, entry rules and kind; rejects with `WorkflowNotReadyError` (the reasons) when refused. */
export function useSaveWorkflowSettings(workflowId: number) {
  const actions = useSenloActions();
  return useMutation({
    mutationFn: async (settings: WorkflowSettings) => unwrapWorkflow(await actions.workflows.updateSettings(workflowId, settings)),
  });
}

/** The workflow's runs by outcome (started, running, completed, goal, failed, cancelled). */
export function useWorkflowRunStats(
  workflowId: number,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.workflows.runStats(workflowId),
    queryFn: async () => unwrap(await actions.workflows.runStats(workflowId)),
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}

/** Event names the project has sent: suggestions for a custom event trigger. */
export function useRecentEventNames(projectId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.workflows.eventNames(projectId),
    queryFn: async () => unwrap(await actions.workflows.eventNames(projectId)),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

/** Field names for the rule builder: contact attributes, and payload keys of the trigger's event. */
export function useFieldSuggestions(projectId: number, eventName: string | null) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.workflows.fieldSuggestions(projectId, eventName),
    queryFn: async () => unwrap(await actions.workflows.fieldSuggestions(projectId, eventName)),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

/** A page of the workflow's runs (newest first); refreshes while open. */
export function useWorkflowRuns(workflowId: number, filter: RunsFilter, options?: { refetchInterval?: number }) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.workflows.runs(workflowId, { ...filter }),
    queryFn: async () => unwrap(await actions.workflows.runs(workflowId, filter)),
    enabled: !!workflowId,
    refetchInterval: options?.refetchInterval,
  });
}

/** One run with its steps, context and graph; refreshes while it is in progress. */
export function useWorkflowRun(runId: number | null) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.workflows.run(runId ?? 0),
    queryFn: async () => unwrap(await actions.workflows.run(runId!)),
    enabled: !!runId,
    refetchInterval: (query) => (query.state.data?.run.status === "RUNNING" ? 5000 : false),
  });
}

/** A contact's runs in every workflow of the project (automation history). */
export function useContactRuns(projectId: number, email: string | null) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.workflows.contactRuns(projectId, email ?? ""),
    queryFn: async () => unwrap(await actions.workflows.contactRuns(projectId, email!)),
    enabled: !!projectId && !!email,
  });
}

/** Cancels a run in progress; the runs lists and the run refetch. */
export function useCancelRun() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: number) => unwrap(await actions.workflows.cancelRun(runId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all }),
  });
}

/** Starts a test run of the saved draft; rejects with `WorkflowNotReadyError` when the draft cannot run. */
export function useStartTestRun(workflowId: number) {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; payload: Record<string, unknown> }) =>
      unwrapWorkflow(await actions.workflows.testRun(workflowId, input)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows.allRuns() }),
  });
}

/** Downloads the automation as a JSON file (its saved draft and settings). */
export function useExportWorkflow(workflowId: number) {
  const actions = useSenloActions();
  return useMutation({
    mutationFn: async (fileName: string) => {
      const data = unwrap(await actions.workflows.export(workflowId));
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      return data;
    },
  });
}

/** A new draft from an export file; resolves with the workflow to open. */
export function useImportWorkflow(projectId: number) {
  const actions = useSenloActions();
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: async (input: { workflow: unknown; name?: string; emails: Record<string, number | null> }) =>
      unwrapWorkflow(await actions.workflows.import(projectId, input)),
    onSettled: invalidate,
  });
}

function useInvalidateWorkflows() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows.lists() });
}

export function useCreateWorkflow(projectId: number) {
  const actions = useSenloActions();
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: async (name: string): Promise<Workflow> =>
      unwrapWorkflow(await actions.workflows.create(projectId, name)),
    onSettled: invalidate,
  });
}

export function useSaveWorkflowGraph(workflowId: number) {
  const actions = useSenloActions();
  return useMutation({
    mutationFn: async (graph: { nodes: unknown[]; edges: unknown[] }) =>
      unwrapWorkflow(await actions.workflows.saveGraph(workflowId, graph)),
  });
}

/** Rejects with `WorkflowNotReadyError` when the saved graph cannot go live. */
export function useSetWorkflowStatus() {
  const actions = useSenloActions();
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Workflow["status"] }) => {
      unwrapWorkflow(await actions.workflows.setStatus(id, status));
      return status;
    },
    onSettled: invalidate,
  });
}

export function useDeleteWorkflow() {
  const actions = useSenloActions();
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: async (id: number) => unwrapWorkflow(await actions.workflows.delete(id)),
    onSettled: invalidate,
  });
}
