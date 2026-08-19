import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Clock } from "lucide-react";
import { AddStepButton } from "./AddStepButton";

export const DelayNode = ({ id, data }: any) => {
  return (
    <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm min-w-[200px] hover:border-blue-200 transition-colors group">
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg border border-purple-100">
          <Clock size={20} />
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Wait</span>
          <span className="block font-bold text-sm text-gray-900 leading-none">Time Delay</span>
        </div>
      </div>
      <div className="text-xs text-gray-500 leading-relaxed font-medium">
        Wait for {data.duration || 1} {data.unit || "days"}
      </div>
      <div className="relative mt-2">
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <AddStepButton 
          parentId={id} 
          className="absolute left-1/2 -translate-x-1/2 -bottom-[34px] z-10" 
        />
      </div>
    </div>
  );
};
