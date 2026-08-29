import React from "react";
import { Handle, Position } from "@xyflow/react";
import { UserCog } from "lucide-react";
import { AddStepButton } from "./AddStepButton";
import { NodeStats } from "./NodeStats";

export const UpdateContactNode = ({ id, data, selected }: any) => {
  return (
    <div
      className={`bg-white border p-4 rounded-xl shadow-sm min-w-[200px] transition-all group ${
        selected
          ? "border-blue-600 shadow-md"
          : "border-gray-200 hover:border-blue-200"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
          <UserCog size={20} />
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Action
          </span>
          <span className="block font-bold text-sm text-gray-900 leading-none">
            Update Contact
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-500 leading-relaxed italic mt-2">
        {data.label ||
          (data.updates
            ? `${Object.keys(data.updates).length} fields`
            : "No updates configured")}
      </div>

      <NodeStats nodeId={id} />

      <div className="relative mt-2">
        <Handle
          type="source"
          position={Position.Bottom}
          className="!opacity-0"
        />
        <AddStepButton
          parentId={id}
          className="absolute left-1/2 -translate-x-1/2 -bottom-[34px] z-10"
        />
      </div>
    </div>
  );
};
