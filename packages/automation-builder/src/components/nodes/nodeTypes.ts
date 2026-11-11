import { MarkerType } from "@xyflow/react";
import { ExitNode } from "./ExitNode";
import { StepNode } from "./StepNode";

/** Every step type's card, shared by the editor canvas and the preview. */
export const STEP_NODE_TYPES = {
  trigger: StepNode,
  action: StepNode,
  delay: StepNode,
  condition: StepNode,
  wait_event: StepNode,
  update_contact: StepNode,
  http_request: StepNode,
  exit: ExitNode,
};

export const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#d4d4d8" },
};
