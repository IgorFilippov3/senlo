// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowSettings } from "@senlo/core";
import { validateWorkflowGraph } from "@senlo/core";
import { AutomationBuilder, WorkflowSettingsForm, useAutomationStore } from "@senlo/automation-builder";
import { Button, Dialog } from "@senlo/ui";
import { WorkflowEditorShell } from "../automations/WorkflowEditorShell";
import { TestRunDialog, WorkflowRunsDialog } from "../automations/RunsPanel";
import { useProjectCampaigns } from "../data/campaigns";
import { useLogRetention } from "../data/workspaces";
import {
  WorkflowNotReadyError,
  useFieldSuggestions,
  useRecentEventNames,
  useSaveWorkflowGraph,
  useSaveWorkflowSettings,
  useExportWorkflow,
  useStartTestRun,
  useWorkflowRunStats,
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
  const [errorsTitle, setErrorsTitle] = useState<string | undefined>(undefined);

  const showReasons = (reasons: string[], title?: string) => {
    setErrorsTitle(title);
    setGoLiveErrors(reasons);
  };

  const save = useSaveWorkflowGraph(workflow.id);
  const changeStatus = useSetWorkflowStatus();
  const { data: triggers = [] } = useProjectCampaigns(workflow.projectId);
  const { data: eventNames = [] } = useRecentEventNames(workflow.projectId);
  // Payload keys follow the event the trigger listens for, as it is on screen.
  const triggerEvent = (nodes.find((n) => n.type === "trigger")?.data as { event?: unknown } | undefined)?.event;
  const { data: fieldSuggestions } = useFieldSuggestions(
    workflow.projectId,
    typeof triggerEvent === "string" && triggerEvent !== "" ? triggerEvent : null,
  );
  const { data: retention } = useLogRetention(workflow.projectId);
  const { data: runStats } = useWorkflowRunStats(workflow.id, { refetchInterval: status === "ACTIVE" ? 10000 : undefined });

  const [settings, setSettings] = useState<WorkflowSettings>(workflow.settings ?? {});
  const [settingsDraft, setSettingsDraft] = useState<WorkflowSettings | null>(null);
  const [settingsErrors, setSettingsErrors] = useState<string[] | null>(null);
  const saveSettings = useSaveWorkflowSettings(workflow.id);

  const submitSettings = async () => {
    if (!settingsDraft) return;
    setSettingsErrors(null);
    try {
      setSettings(await saveSettings.mutateAsync(settingsDraft));
      setSettingsDraft(null);
    } catch (error) {
      setSettingsErrors(error instanceof WorkflowNotReadyError ? error.reasons : [(error as Error).message]);
    }
  };
  const [runsOpen, setRunsOpen] = useState(false);
  const [openRunId, setOpenRunId] = useState<number | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testErrors, setTestErrors] = useState<string[] | null>(null);
  const testRun = useStartTestRun(workflow.id);
  const exportWorkflow = useExportWorkflow(workflow.id);

  /** Exports the saved draft, so a paused or draft automation is saved first (a live one exports as last saved). */
  const exportFile = async () => {
    if (status !== "ACTIVE") await save.mutateAsync({ nodes, edges });
    const slug = workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "automation";
    await exportWorkflow.mutateAsync(`${slug}.senlo-automation.json`);
  };

  /**
   * A test run executes the saved draft, so a paused or draft automation is
   * saved first. A live one is not (its save publishes): it tests the graph
   * as last saved.
   */
  const startTestRun = async (input: { email: string; payload: Record<string, unknown> }) => {
    setTestErrors(null);
    try {
      if (status !== "ACTIVE") await save.mutateAsync({ nodes, edges });
      const { runId } = await testRun.mutateAsync(input);
      setTestOpen(false);
      setOpenRunId(runId);
      setRunsOpen(true);
    } catch (error) {
      setTestErrors(error instanceof WorkflowNotReadyError ? error.reasons : [(error as Error).message]);
    }
  };

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
        // Laid out by the builder from the graph's structure.
        position: { x: 0, y: 0 },
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
      showReasons(check.reasons);
      return;
    }
    try {
      await save.mutateAsync({ nodes, edges });
      setStatus(await changeStatus.mutateAsync({ id: workflow.id, status: "ACTIVE" }));
    } catch (error) {
      if (error instanceof WorkflowNotReadyError) showReasons(error.reasons);
    }
  };

  /**
   * Saving a live automation publishes it: runs started from now on use the
   * new graph, so it must be complete. An incomplete one is kept only as a
   * draft, after a pause.
   */
  const saveGraph = async () => {
    changeStatus.reset();
    const liveTitle = "Cannot save a live automation";
    if (status === "ACTIVE") {
      const check = validateWorkflowGraph(nodes, edges);
      if (!check.valid) {
        showReasons([...check.reasons, "Pause the automation to save an incomplete draft."], liveTitle);
        return;
      }
    }
    try {
      await save.mutateAsync({ nodes, edges });
    } catch (error) {
      if (error instanceof WorkflowNotReadyError) {
        showReasons([...error.reasons, "Pause the automation to save an incomplete draft."], liveTitle);
      }
    }
  };

  const failure = save.error ?? changeStatus.error ?? exportWorkflow.error;

  return (
    <WorkflowEditorShell
      name={workflow.name}
      status={status}
      onBack={back}
      onSave={() => void saveGraph()}
      isSaving={save.isPending}
      onToggleStatus={toggleStatus}
      isChangingStatus={changeStatus.isPending}
      error={failure && !(failure instanceof WorkflowNotReadyError) ? failure.message : null}
      goLiveErrors={goLiveErrors}
      onDismissGoLiveErrors={() => setGoLiveErrors(null)}
      goLiveErrorsTitle={errorsTitle}
      onOpenSettings={() => {
        setSettingsErrors(null);
        setSettingsDraft(settings);
      }}
      onOpenRuns={() => {
        setOpenRunId(null);
        setRunsOpen(true);
      }}
      onExport={() => void exportFile().catch(() => {})}
      onTestRun={() => {
        setTestErrors(null);
        setTestOpen(true);
      }}
      summary={runStats && runStats.started > 0 ? runSummary(runStats, !!settings.goal) : undefined}
    >
      <AutomationBuilder
        triggers={triggers}
        stats={stats}
        eventNames={eventNames}
        fieldSuggestions={fieldSuggestions}
        historyRetentionDays={retention?.days}
      />
      <WorkflowRunsDialog
        isOpen={runsOpen}
        onClose={() => setRunsOpen(false)}
        workflowId={workflow.id}
        projectId={workflow.projectId}
        initialRunId={openRunId}
      />
      <TestRunDialog
        isOpen={testOpen}
        onClose={() => setTestOpen(false)}
        eventName={typeof triggerEvent === "string" && triggerEvent !== "" ? triggerEvent : null}
        onStart={(input) => void startTestRun(input)}
        isStarting={save.isPending || testRun.isPending}
        errors={testErrors}
      />
      <Dialog
        isOpen={settingsDraft !== null}
        onClose={() => setSettingsDraft(null)}
        title="Automation settings"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettingsDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitSettings()} disabled={saveSettings.isPending}>
              {saveSettings.isPending ? "Saving..." : status === "ACTIVE" ? "Save and publish" : "Save"}
            </Button>
          </>
        }
      >
        {settingsDraft && (
          <WorkflowSettingsForm
            value={settingsDraft}
            onChange={setSettingsDraft}
            eventNames={eventNames}
            fieldSuggestions={fieldSuggestions}
          />
        )}
        {settingsErrors && (
          <ul className="mt-4 list-disc pl-4 text-sm text-red-600 space-y-1">
            {settingsErrors.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </Dialog>
    </WorkflowEditorShell>
  );
}

/** "120 runs · 18 reached the goal (15%)", or without a goal "120 runs · 4 running". */
function runSummary(stats: { started: number; running: number; goal: number }, hasGoal: boolean): string {
  const runs = `${stats.started} ${stats.started === 1 ? "run" : "runs"}`;
  if (!hasGoal) return `${runs} · ${stats.running} running`;
  const rate = Math.round((stats.goal / stats.started) * 100);
  return `${runs} · ${stats.goal} reached the goal (${rate}%)`;
}
