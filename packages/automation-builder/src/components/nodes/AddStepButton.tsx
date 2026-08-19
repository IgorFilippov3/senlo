import React from "react";
import { Plus, Mail, Clock, GitBranch } from "lucide-react";
import { DropdownMenu } from "@senlo/ui";
import { useAutomationStore } from "../../store/automationStore";

interface AddStepButtonProps {
  parentId: string;
  sourceHandle?: string;
  className?: string;
}

export const AddStepButton = ({ parentId, sourceHandle, className }: AddStepButtonProps) => {
  const addChildNode = useAutomationStore((state) => state.addChildNode);

  const items = [
    {
      label: "Send Email",
      icon: <Mail size={14} className="text-blue-600" />,
      onClick: () => addChildNode(parentId, "action", sourceHandle),
    },
    {
      label: "Wait Delay",
      icon: <Clock size={14} className="text-purple-600" />,
      onClick: () => addChildNode(parentId, "delay", sourceHandle),
    },
    {
      label: "API Check",
      icon: <GitBranch size={14} className="text-green-600" />,
      onClick: () => addChildNode(parentId, "condition", sourceHandle),
    },
  ];

  return (
    <div className={className}>
      <DropdownMenu
        align="center"
        side="bottom"
        trigger={
          <button 
            className="w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-500 hover:scale-110 transition-all shadow-sm group"
            title="Add next step"
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        }
        items={items}
      />
    </div>
  );
};
