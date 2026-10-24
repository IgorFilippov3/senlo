// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextNavigationProvider } from "@senlo/next/client";
import { SidebarWrapper } from "@/components/sidebar/sidebar-wrapper";
import { QueryProvider } from "@/providers";
import { DialogProvider } from "@/providers/dialogs";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NextNavigationProvider>
      <QueryProvider>
        <SidebarWrapper>{children}</SidebarWrapper>
        <DialogProvider />
      </QueryProvider>
    </NextNavigationProvider>
  );
}
