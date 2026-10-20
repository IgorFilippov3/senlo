"use client";

import type { ReactNode } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { SenloDataProvider } from "@senlo/features";
import { clientActions } from "@/lib/client-actions";

/** The data layer over this app's Server Actions, plus devtools in development. */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <SenloDataProvider actions={clientActions}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </SenloDataProvider>
  );
}
