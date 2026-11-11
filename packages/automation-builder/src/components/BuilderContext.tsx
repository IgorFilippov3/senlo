import React, { createContext, useContext } from "react";

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
}

const BuilderContext = createContext<BuilderContextValue>({
  triggers: [],
  eventNames: [],
  fieldSuggestions: { contact: [], event: [] },
});

export const BuilderProvider = BuilderContext.Provider;

export const useBuilderContext = () => useContext(BuilderContext);
