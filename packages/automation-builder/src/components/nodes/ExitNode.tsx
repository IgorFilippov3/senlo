import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@senlo/ui";
import { useBuilderContext, useNodeStats } from "../BuilderContext";

/** The end of a branch, as a pill (`END_WIDTH` x `END_HEIGHT` in the layout). */
export const ExitNode = ({ id, selected }: NodeProps) => {
  const total = useNodeStats(id)?.total;
  const { readOnly } = useBuilderContext();

  return (
    <div
      className={cn(
        !readOnly && "cursor-pointer",
        "flex h-9 w-24 items-center justify-center gap-1.5 rounded-full border bg-white text-[14px] font-medium text-gray-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-[border-color,box-shadow]",
        selected ? "border-blue-500 ring-4 ring-blue-500/10" : readOnly ? "border-gray-200" : "border-gray-200 hover:border-gray-300",
      )}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      End
      {total !== undefined && (
        <span className="text-[11px] tabular-nums text-gray-400" title="Contacts that ended here">
          {total}
        </span>
      )}
    </div>
  );
};
