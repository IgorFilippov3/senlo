import React, { createContext, useContext } from "react";
import type { WorkflowNodeStats } from "@senlo/core";
import { useAutomationStore } from "../store/automationStore";

export interface BuilderTrigger {
  id: number;
  name: string;
}

/** What step cards need from the host to describe themselves. */
/** Field names the rule builder suggests. */
export interface BuilderFieldSuggestions {
  /** Contact attributes seen in the project. */
  contact: string[];
  /** Payload keys of recent events with the trigger's name. */
  event: string[];
}

interface BuilderContextValue {
  triggers: BuilderTrigger[];
  /** Event names the project has sent, most recent first: custom event suggestions. */
  eventNames: string[];
  fieldSuggestions: BuilderFieldSuggestions;
  /**
   * Days the workspace keeps its event history (null: forever, undefined:
   * unknown). A history rule cannot look further back.
   */
  historyRetentionDays?: number | null;
  /**
   * A preview (`WorkflowPreview`): no `+`, no selection, and step counts come
   * from `nodeStats` below instead of the editor's store, so a preview never
   * reads or changes the graph of an open editor.
   */
  readOnly?: boolean;
  /** Counts by node id for a read-only canvas. */
  nodeStats?: Record<string, WorkflowNodeStats>;
}

const BuilderContext = createContext<BuilderContextValue>({
  triggers: [],
  eventNames: [],
  fieldSuggestions: { contact: [], event: [] },
});

export const BuilderProvider = BuilderContext.Provider;

export const useBuilderContext = () => useContext(BuilderContext);

/** A step's counts: the editor's store, or the preview's own. */
export function useNodeStats(nodeId: string): WorkflowNodeStats | undefined {
  const { readOnly, nodeStats } = useBuilderContext();
  const fromStore = useAutomationStore((state) => state.nodeStats[nodeId]);
  return readOnly ? nodeStats?.[nodeId] : fromStore;
}
