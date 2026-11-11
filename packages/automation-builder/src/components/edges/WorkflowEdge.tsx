import React from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { useAutomationStore } from "../../store/automationStore";
import { BRANCH_SPLIT, type WorkflowEdgeData } from "../../layout/layoutWorkflow";
import { INSERTABLE_TYPES } from "../../store/graphOps";
import { AddStepMenu } from "../AddStepMenu";
import { useBuilderContext } from "../BuilderContext";

const STROKE = "#d4d4d8";

/**
 * A line between steps: straight down, or for a branch, down to a split just
 * under the API check, across, then down past its Yes/No label. A real edge
 * carries a `+` near its end to insert a step there.
 */
export const WorkflowEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) => {
  const { label, insertable } = (data ?? { insertable: false }) as WorkflowEdgeData;
  const insertNode = useAutomationStore((state) => state.insertNode);
  const { readOnly } = useBuilderContext();

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
    centerY: label ? sourceY + BRANCH_SPLIT : undefined,
  });

  // The label sits on the branch's own vertical run, the `+` just above the next step.
  const labelY = sourceY + BRANCH_SPLIT + 36;
  const plusY = label ? targetY - 22 : (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={insertable ? markerEnd : undefined} style={{ stroke: STROKE, strokeWidth: 1.5 }} />
      <EdgeLabelRenderer>
        {label && (
          <div
            className="nodrag nopan pointer-events-none absolute flex h-7 items-center rounded-full border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
            style={{ transform: `translate(-50%, -50%) translate(${targetX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        )}
        {insertable && !readOnly && (
          <div
            className="nodrag nopan absolute"
            style={{ transform: `translate(-50%, -50%) translate(${targetX}px, ${plusY}px)`, pointerEvents: "all" }}
            onClick={(event) => event.stopPropagation()}
          >
            <AddStepMenu types={INSERTABLE_TYPES} onSelect={(type) => insertNode(id, type)}>
              <button
                type="button"
                className="flex size-[18px] items-center justify-center rounded-full border border-gray-300 bg-white text-gray-400 opacity-80 transition-all hover:scale-110 hover:border-blue-500 hover:text-blue-600 hover:opacity-100"
                title="Insert a step here"
              >
                <Plus size={11} strokeWidth={2.5} />
              </button>
            </AddStepMenu>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};
