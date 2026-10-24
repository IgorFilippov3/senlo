// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import type { ReactNode } from "react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AppShell, AppSidebar } from "@senlo/features";
import { SenloAppProvider } from "@senlo/next/client";
import { logoutAction } from "@/app/(auth)/actions";
import { clientActions } from "@/lib/client-actions";

/** The signed-in app around every page: navigation, data and dialogs, sidebar, devtools in development. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SenloAppProvider actions={clientActions}>
      <AppShell sidebar={<AppSidebar brandName="Senlo Email" brandIcon="S" onSignOut={logoutAction} />}>
        {children}
      </AppShell>
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </SenloAppProvider>
  );
}
