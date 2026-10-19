// The rules live in core so the server enforces the same ones before a
// workflow goes live. Re-exported under the builder's original names.
export {
  normalizeHandle,
  hasOutgoingOnHandle,
  validateWorkflowConnection,
  validateAddChild,
  validateWorkflowGraph,
  type GraphNodeRef as GraphNode,
  type GraphEdgeRef as GraphEdge,
  type ConnectionLike,
  type ConnectionValidationResult as ValidationResult,
  type GraphValidationResult,
} from "@senlo/core";
