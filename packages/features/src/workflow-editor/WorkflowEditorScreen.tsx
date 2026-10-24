// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import type { Workflow, WorkflowEdge, WorkflowNode } from "@senlo/core";
import { validateWorkflowGraph } from "@senlo/core";
import { AutomationBuilder, useAutomationStore } from "@senlo/automation-builder";
import { WorkflowEditorShell } from "../automations/WorkflowEditorShell";
import { useProjectCampaigns } from "../data/campaigns";
import {
  WorkflowNotReadyError,
  useSaveWorkflowGraph,
  useSetWorkflowStatus,
  useWorkflowStats,
} from "../data/workflows";
import { useSenloNavigation } from "../layout/navigation-context";

export interface WorkflowEditorScreenProps {
  /** Loaded on the server (`WorkflowService.getGraph`). */
  workflow: Workflow;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/**
 * The automation editor: the canvas over the stored graph, save, go live
 * or pause, live step stats while active. Its own entry
 * (`@senlo/features/workflow-editor`), so the canvas library stays out of
 * every other page's bundle.
 */
export function WorkflowEditorScreen({ workflow, nodes: savedNodes, edges: savedEdges }: WorkflowEditorScreenProps) {
  const { back } = useSenloNavigation();
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

  /**
   * Going live saves first: the server checks the stored graph, so it must be
   * the one on screen. The same rules run here first for instant feedback.
   */
  const toggleStatus = async () => {
    save.reset();
    changeStatus.reset();
    if (status === "ACTIVE") {
      changeStatus.mutate({ id: workflow.id, status: "PAUSED" }, { onSuccess: setStatus });
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
      if (error instanceof WorkflowNotReadyError) setGoLiveErrors(error.reasons);
    }
  };

  const failure = save.error ?? changeStatus.error;

  return (
    <WorkflowEditorShell
      name={workflow.name}
      status={status}
      onBack={back}
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
