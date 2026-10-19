"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Workflow, WorkflowEdge, WorkflowNode } from "@senlo/core";
import { validateWorkflowGraph } from "@senlo/core";
import { AutomationBuilder, useAutomationStore } from "@senlo/automation-builder";
import { WorkflowEditorShell } from "@senlo/features";
import { useProjectCampaigns } from "apps/web/queries/campaigns";
import {
  WorkflowNotReadyError,
  useSaveWorkflowGraph,
  useSetWorkflowStatus,
  useWorkflowStats,
} from "apps/web/queries/automations";

interface WorkflowEditorProps {
  workflow: Workflow;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export function WorkflowEditor({ workflow, nodes: savedNodes, edges: savedEdges }: WorkflowEditorProps) {
  const router = useRouter();
  const { nodes, edges, setNodes, setEdges } = useAutomationStore();
  const [status, setStatus] = useState(workflow.status);
  const [goLiveErrors, setGoLiveErrors] = useState<string[] | null>(null);

  const save = useSaveWorkflowGraph(workflow.id);
  const changeStatus = useSetWorkflowStatus();
  const { data: triggers = [] } = useProjectCampaigns(workflow.projectId);
  const { data: stats = [] } = useWorkflowStats(workflow.id, {
    enabled: status === "ACTIVE",
    refetchInterval: 10000,
  });

  useEffect(() => {
    setNodes(
      savedNodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data,
        position: { x: n.positionX, y: n.positionY },
      })),
    );
    setEdges(
      savedEdges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        sourceHandle: e.sourceHandle,
      })),
    );
  }, [savedNodes, savedEdges, setNodes, setEdges]);

  const showFailure = (error: Error) => {
    if (error instanceof WorkflowNotReadyError) setGoLiveErrors(error.reasons);
  };

  /**
   * Going live saves first: the server checks the stored graph, so it must be
   * the one on screen. The same rules run here first for instant feedback.
   */
  const toggleStatus = async () => {
    save.reset();
    changeStatus.reset();
    if (status === "ACTIVE") {
      changeStatus.mutate(
        { id: workflow.id, status: "PAUSED" },
        { onSuccess: setStatus },
      );
      return;
    }

    const check = validateWorkflowGraph(nodes, edges);
    if (!check.valid) {
      setGoLiveErrors(check.reasons);
      return;
    }
    try {
      await save.mutateAsync({ nodes, edges });
      setStatus(await changeStatus.mutateAsync({ id: workflow.id, status: "ACTIVE" }));
    } catch (error) {
      showFailure(error as Error);
    }
  };

  const failure = save.error ?? changeStatus.error;

  return (
    <WorkflowEditorShell
      name={workflow.name}
      status={status}
      onBack={() => router.back()}
      onSave={() => {
        changeStatus.reset();
        save.mutate({ nodes, edges });
      }}
      isSaving={save.isPending}
      onToggleStatus={toggleStatus}
      isChangingStatus={changeStatus.isPending}
      error={failure && !(failure instanceof WorkflowNotReadyError) ? failure.message : null}
      goLiveErrors={goLiveErrors}
      onDismissGoLiveErrors={() => setGoLiveErrors(null)}
    >
      <AutomationBuilder triggers={triggers} stats={stats} />
    </WorkflowEditorShell>
  );
}
