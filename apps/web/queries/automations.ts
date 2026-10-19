import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workflow } from "@senlo/core";
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflowStats,
  listWorkflows,
  saveWorkflowGraph,
  updateWorkflowStatus,
} from "apps/web/app/(app)/workspace/[id]/automations/actions";
import type { ActionResult } from "apps/web/lib/errors";
import { unwrap } from "./result";

export const automationKeys = {
  all: ["automations"] as const,
  lists: () => [...automationKeys.all, "list"] as const,
  list: (projectId: number) => [...automationKeys.lists(), projectId] as const,
  details: () => [...automationKeys.all, "detail"] as const,
  detail: (id: number) => [...automationKeys.details(), id] as const,
  stats: (id: number) => [...automationKeys.detail(id), "stats"] as const,
};

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
  return useQuery({
    queryKey: automationKeys.list(projectId),
    queryFn: async () => unwrap(await listWorkflows(projectId)),
    enabled: !!projectId,
  });
}

export function useWorkflowStats(
  workflowId: number,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  return useQuery({
    queryKey: automationKeys.stats(workflowId),
    queryFn: async () => unwrap(await getWorkflowStats(workflowId)),
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}

function useInvalidateWorkflows() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: automationKeys.lists() });
}

export function useCreateWorkflow(projectId: number) {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: async (name: string): Promise<Workflow> =>
      unwrapWorkflow(await createWorkflow(projectId, name)),
    onSettled: invalidate,
  });
}

export function useSaveWorkflowGraph(workflowId: number) {
  return useMutation({
    mutationFn: async (graph: { nodes: unknown[]; edges: unknown[] }) =>
      unwrapWorkflow(await saveWorkflowGraph(workflowId, graph.nodes, graph.edges)),
  });
}

/** Rejects with `WorkflowNotReadyError` when the saved graph cannot go live. */
export function useSetWorkflowStatus() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Workflow["status"] }) => {
      unwrapWorkflow(await updateWorkflowStatus(id, status));
      return status;
    },
    onSettled: invalidate,
  });
}

export function useDeleteWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: async (id: number) => unwrapWorkflow(await deleteWorkflow(id)),
    onSettled: invalidate,
  });
}
