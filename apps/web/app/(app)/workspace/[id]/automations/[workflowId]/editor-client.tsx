"use client";

import { useEffect, useState } from "react";
import {
  AutomationBuilder,
  useAutomationStore,
} from "@senlo/automation-builder";
import { Workflow, WorkflowNode, WorkflowEdge } from "@senlo/core";
import { Button } from "@senlo/ui";
import { Save, Play, Pause, ChevronLeft } from "lucide-react";
import { saveWorkflowGraph, updateWorkflowStatus } from "../actions";
import { listProjectCampaigns } from "../../triggers/actions";
import { useRouter } from "next/navigation";
import { logger } from "apps/web/lib/logger";
import { Badge } from "@senlo/ui";

interface Props {
  initialWorkflow: Workflow;
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
}

export const WorkflowEditorClient = ({
  initialWorkflow,
  initialNodes,
  initialEdges,
}: Props) => {
  const router = useRouter();
  const { nodes, edges, setNodes, setEdges } = useAutomationStore();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(initialWorkflow.status);
  const [triggers, setTriggers] = useState<any[]>([]);

  useEffect(() => {
    // Map DB nodes to React Flow nodes
    const rfNodes = initialNodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data,
      position: { x: n.positionX, y: n.positionY },
    }));

    // Map DB edges to React Flow edges
    const rfEdges = initialEdges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      sourceHandle: e.sourceHandle,
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);

    // Fetch triggers (campaigns) instead of raw templates
    const fetchTriggers = async () => {
      const result = await listProjectCampaigns(initialWorkflow.projectId);
      if (result.success) {
        setTriggers(result.data);
      }
    };
    fetchTriggers();
  }, [
    initialNodes,
    initialEdges,
    setNodes,
    setEdges,
    initialWorkflow.projectId,
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveWorkflowGraph(initialWorkflow.id, nodes, edges);
      if (result.success) {
        logger.info("Workflow saved successfully");
      } else {
        logger.error("Failed to save workflow", { error: result.error });
      }
    } catch (error) {
      logger.error("Error saving workflow", { error });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    const newStatus = status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const result = await updateWorkflowStatus(initialWorkflow.id, newStatus);
      if (result.success) {
        setStatus(newStatus);
      }
    } catch (error) {
      logger.error("Error updating workflow status", { error });
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-gray-50 p-6">
      <div className="h-16 border border-gray-200 bg-white flex items-center justify-between px-6 z-10 shadow-sm rounded-xl mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-gray-100"
            onClick={() => router.back()}
          >
            <ChevronLeft size={20} className="text-gray-500" />
          </Button>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-none mb-1">
              {initialWorkflow.name}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Automation Builder
              </span>
              <Badge
                variant={status === "ACTIVE" ? "success" : "secondary"}
                className="h-4 text-[9px] px-1.5 uppercase font-bold"
              >
                {status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="font-semibold text-xs uppercase tracking-wider h-9 border-gray-200"
            onClick={toggleStatus}
          >
            {status === "ACTIVE" ? (
              <>
                <Pause size={14} className="mr-2" /> Pause
              </>
            ) : (
              <>
                <Play size={14} className="mr-2" /> Go Live
              </>
            )}
          </Button>
          <Button
            className="font-semibold text-xs uppercase tracking-wider h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={14} className="mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <AutomationBuilder triggers={triggers} />
      </div>
    </div>
  );
};
