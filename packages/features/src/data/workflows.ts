"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActionResult, Workflow } from "@senlo/core";
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
