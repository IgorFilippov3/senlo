import React from "react";
import { Handle, Position } from "@xyflow/react";
import { LogOut } from "lucide-react";
import { NodeStats } from "./NodeStats";

export const ExitNode = ({ id, selected }: any) => {
  return (
    <div
      className={`bg-white border p-4 rounded-xl shadow-sm min-w-[150px] transition-all group ${
        selected
          ? "border-red-600 shadow-md"
          : "border-gray-200 hover:border-red-200"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-100">
          <LogOut size={20} />
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            End
          </span>
          <span className="block font-bold text-sm text-gray-900 leading-none">
            Exit
          </span>
        </div>
      </div>

      <NodeStats nodeId={id} />
    </div>
  );
};
