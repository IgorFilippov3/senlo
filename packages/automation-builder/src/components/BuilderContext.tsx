import React, { createContext, useContext } from "react";

export interface BuilderTrigger {
  id: number;
  name: string;
}

/** What step cards need from the host to describe themselves. */
interface BuilderContextValue {
  triggers: BuilderTrigger[];
  /** Event names the project has sent, most recent first: custom event suggestions. */
  eventNames: string[];
}

const BuilderContext = createContext<BuilderContextValue>({ triggers: [], eventNames: [] });

export const BuilderProvider = BuilderContext.Provider;

export const useBuilderContext = () => useContext(BuilderContext);
