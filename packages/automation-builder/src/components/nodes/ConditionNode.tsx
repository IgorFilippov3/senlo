import React from "react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { AddStepButton } from "./AddStepButton";
import { NodeStats } from "./NodeStats";

export const ConditionNode = ({ id, data, selected }: any) => {
  return (
    <div
      className={`bg-white border p-4 rounded-xl shadow-sm min-w-[220px] transition-all group ${
        selected
          ? "border-blue-600 shadow-md"
          : "border-gray-200 hover:border-blue-200"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-100">
          <GitBranch size={20} />
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Logic
          </span>
          <span className="block font-bold text-sm text-gray-900 leading-none">
            API Check
          </span>
        </div>
      </div>
      <div className="text-[11px] text-gray-500 leading-relaxed truncate max-w-[190px] bg-gray-50 p-2 rounded border border-gray-100 mt-2">
        {data.url || "https://api.example.com/check"}
      </div>

      <NodeStats nodeId={id} />

      <div className="flex justify-center gap-16 mt-4 pt-4 border-t border-gray-50 relative">
        <div className="relative flex flex-col items-center">
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!opacity-0"
          />
          <AddStepButton
            parentId={id}
            sourceHandle="no"
            variant="destructive"
            className="absolute left-1/2 -translate-x-1/2 -bottom-[28px] z-10"
          />
        </div>
        <div className="relative flex flex-col items-center">
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!opacity-0"
          />
          <AddStepButton
            parentId={id}
            sourceHandle="yes"
            variant="success"
            className="absolute left-1/2 -translate-x-1/2 -bottom-[28px] z-10"
          />
        </div>
      </div>
    </div>
  );
};
