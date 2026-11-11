import { isBranchingType } from "@senlo/core";
import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@senlo/ui";
import { useBuilderContext } from "../BuilderContext";
import { NodeStats } from "./NodeStats";
import { STEP_META } from "./stepMeta";

/**
 * Every step except End: an icon tile, what the step is, and what it does.
 * Fixed size (`STEP_WIDTH` x `STEP_HEIGHT` in the layout, plus the stats
 * strip when there is one).
 */
export const StepNode = ({ id, type, data, selected }: NodeProps) => {
  const { triggers } = useBuilderContext();
  const meta = STEP_META[type] ?? STEP_META.action;
  const Icon = meta.icon;
  const summary = meta.summary(data as Record<string, any>, { triggers });

  return (
    <div
      className={cn(
        "w-[280px] cursor-pointer rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-[border-color,box-shadow]",
        selected
          ? "border-blue-500 ring-4 ring-blue-500/10"
          : "border-gray-200 hover:border-gray-300 hover:shadow-[0_2px_6px_rgba(16,24,40,0.08)]",
      )}
    >
      {type !== "trigger" && <Handle type="target" position={Position.Top} isConnectable={false} />}

      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
          <Icon size={17} strokeWidth={1.75} className={meta.tone} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] leading-4 text-gray-500">{meta.kind}</div>
          <div
            className={cn(
              "truncate text-[14px] font-medium leading-5",
              summary.incomplete ? "text-gray-400" : "text-gray-900",
            )}
            title={summary.text}
          >
            {summary.text}
          </div>
        </div>
      </div>

      <NodeStats nodeId={id} />

      {isBranchingType(type) ? (
        <>
          <Handle type="source" id="yes" position={Position.Bottom} isConnectable={false} />
          <Handle type="source" id="no" position={Position.Bottom} isConnectable={false} />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} isConnectable={false} />
      )}
    </div>
  );
};
