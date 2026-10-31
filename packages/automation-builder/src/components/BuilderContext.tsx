import React, { createContext, useContext } from "react";

export interface BuilderTrigger {
  id: number;
  name: string;
}

/** What step cards need from the host to describe themselves. */
interface BuilderContextValue {
  triggers: BuilderTrigger[];
}

const BuilderContext = createContext<BuilderContextValue>({ triggers: [] });

export const BuilderProvider = BuilderContext.Provider;

export const useBuilderContext = () => useContext(BuilderContext);
