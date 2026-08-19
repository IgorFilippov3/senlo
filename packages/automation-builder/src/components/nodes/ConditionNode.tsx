import React from "react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { AddStepButton } from "./AddStepButton";

export const ConditionNode = ({ id, data }: any) => {
  return (
    <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm min-w-[220px] hover:border-blue-200 transition-colors group">
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-100">
          <GitBranch size={20} />
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Logic</span>
          <span className="block font-bold text-sm text-gray-900 leading-none">API Check</span>
        </div>
      </div>
      <div className="text-[11px] text-gray-500 leading-relaxed truncate max-w-[190px] bg-gray-50 p-1.5 rounded border border-gray-100">
        {data.url || "https://api.example.com/check"}
      </div>
      <div className="flex justify-between mt-5 pt-4 border-t border-gray-50 relative">
        <div className="relative flex flex-col items-center">
          <span className="text-[9px] font-black uppercase text-green-600 mb-1">Yes</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!opacity-0"
          />
          <AddStepButton 
            parentId={id} 
            sourceHandle="yes"
            className="absolute left-1/2 -translate-x-1/2 -bottom-[34px] z-10" 
          />
        </div>
        <div className="relative flex flex-col items-center">
          <span className="text-[9px] font-black uppercase text-red-500 mb-1">No</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!opacity-0"
          />
          <AddStepButton 
            parentId={id} 
            sourceHandle="no"
            className="absolute left-1/2 -translate-x-1/2 -bottom-[34px] z-10" 
          />
        </div>
      </div>
    </div>
  );
};
