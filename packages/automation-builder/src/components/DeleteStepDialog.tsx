import React from "react";
import { Button, Dialog } from "@senlo/ui";
import { useAutomationStore } from "../store/automationStore";
import { stepsRemovedBy } from "../store/graphOps";
import { STEP_META } from "./nodes/stepMeta";

interface DeleteStepDialogProps {
  nodeId: string | null;
  onClose: () => void;
}

/** Confirms deleting a step, saying how much of the flow goes with it. */
export const DeleteStepDialog = ({ nodeId, onClose }: DeleteStepDialogProps) => {
  const { nodes, edges, deleteNode } = useAutomationStore();
  const node = nodes.find((n) => n.id === nodeId);
  const others = node ? stepsRemovedBy(nodes, edges, node.id).size - 1 : 0;
  const kind = node ? (STEP_META[node.type ?? ""]?.kind ?? "step") : "step";

  const confirm = () => {
    if (node) deleteNode(node.id);
    onClose();
  };

  return (
    <Dialog
      isOpen={node !== undefined}
      onClose={onClose}
      title={`Delete “${kind}”?`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm}>
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-500">
        {others > 0
          ? `Both of its branches go too: ${others} more ${others === 1 ? "step" : "steps"}.`
          : "The steps after it move up to take its place."}{" "}
        Contacts already in this automation may be affected.
      </p>
    </Dialog>
  );
};
