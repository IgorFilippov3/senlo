"use client";

import React, { createContext, useContext, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SenloActions } from "./actions";

/** Query defaults for the Senlo UI. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: { retry: 1 },
    },
  });
}

const ActionsContext = createContext<SenloActions | null>(null);

/**
 * Gives the data hooks their transport and a query cache. The cache is made
 * once per provider (per browser tab, per request on the server), never at
 * module level, so two users' data can never share one.
 */
export function SenloDataProvider({
  actions,
  queryClient,
  children,
}: {
  actions: SenloActions;
  /** Defaults to `createQueryClient()`. */
  queryClient?: QueryClient;
  children: React.ReactNode;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <ActionsContext.Provider value={actions}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ActionsContext.Provider>
  );
}

export function useSenloActions(): SenloActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error("useSenloActions must be used inside a SenloDataProvider");
  return actions;
}
