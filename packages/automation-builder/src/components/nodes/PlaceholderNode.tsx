import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { useAutomationStore } from "../../store/automationStore";
import type { PlaceholderData } from "../../layout/layoutWorkflow";
import { AddStepMenu } from "../AddStepMenu";
import { ADDABLE_TYPES } from "./stepMeta";

/** The `+` at an open end of the flow: picks the next step. */
export const PlaceholderNode = ({ data }: NodeProps) => {
  const { parentId, sourceHandle } = data as PlaceholderData;
  const addChildNode = useAutomationStore((state) => state.addChildNode);

  return (
    <div className="size-7">
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <AddStepMenu types={ADDABLE_TYPES} onSelect={(type) => addChildNode(parentId, type, sourceHandle)}>
        <button
          type="button"
          className="nodrag nopan flex size-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-colors hover:border-blue-500 hover:text-blue-600"
          title="Add a step"
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </AddStepMenu>
    </div>
  );
};
