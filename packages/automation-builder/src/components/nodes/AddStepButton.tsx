import React from "react";
import { Plus, Mail, Clock, GitBranch, UserCog, LogOut } from "lucide-react";
import { DropdownMenu } from "@senlo/ui";
import { useAutomationStore } from "../../store/automationStore";
import { hasOutgoingOnHandle } from "../../validation/workflowConnections";

interface AddStepButtonProps {
  parentId: string;
  sourceHandle?: string;
  className?: string;
  variant?: "default" | "success" | "destructive";
}

export const AddStepButton = ({
  parentId,
  sourceHandle,
  className,
  variant = "default",
}: AddStepButtonProps) => {
  const addChildNode = useAutomationStore((state) => state.addChildNode);
  const occupied = useAutomationStore((state) =>
    hasOutgoingOnHandle(state.edges, parentId, sourceHandle),
  );

  if (occupied) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return {
          backgroundColor: "var(--sl-color-success-bg)",
          color: "var(--sl-color-success-text)",
        };
      case "destructive":
        return {
          backgroundColor: "var(--sl-color-destructive)",
          color: "white",
        };
      default:
        return {
          backgroundColor: "white",
          color: "var(--sl-color-text-secondary)",
        };
    }
  };

  const styles = getVariantStyles();

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
    {
      label: "Update Contact",
      icon: <UserCog size={14} className="text-orange-600" />,
      onClick: () => addChildNode(parentId, "update_contact", sourceHandle),
    },
    {
      label: "Exit",
      icon: <LogOut size={14} className="text-red-600" />,
      onClick: () => addChildNode(parentId, "exit", sourceHandle),
    },
  ];

  return (
    <div className={className}>
      <DropdownMenu
        align="center"
        side="bottom"
        trigger={
          <button
            className="w-6 h-6 border border-gray-200 rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-sm group"
            style={styles}
            title={
              variant === "success"
                ? "Add YES step"
                : variant === "destructive"
                  ? "Add NO step"
                  : "Add next step"
            }
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        }
        items={items}
      />
    </div>
  );
};
