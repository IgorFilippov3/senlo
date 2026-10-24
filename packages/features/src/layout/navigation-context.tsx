// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { createContext, useContext } from "react";
import type { RenderLink } from "./Sidebar";
import type { SenloPaths } from "./paths";

/**
 * How the screens move around, provided by the host: its router and link
 * component, and its URLs. Features never import a router; `@senlo/next/client`
 * has the Next.js implementation (`NextNavigationProvider`).
 */
export interface SenloNavigation {
  paths: SenloPaths;
  /** The current path, without the query string. */
  pathname: string;
  renderLink: RenderLink;
  push(href: string): void;
  replace(href: string): void;
  /** Re-fetches what the server rendered for the current page. */
  refresh(): void;
}

const NavigationContext = createContext<SenloNavigation | null>(null);

export function SenloNavigationProvider({
  value,
  children,
}: {
  value: SenloNavigation;
  children: React.ReactNode;
}) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useSenloNavigation(): SenloNavigation {
  const navigation = useContext(NavigationContext);
  if (!navigation) {
    throw new Error("useSenloNavigation needs a SenloNavigationProvider (NextNavigationProvider in a Next.js host)");
  }
  return navigation;
}

/** The host's navigation when the screen is under a provider; null on pages outside the app shell. */
export function useOptionalSenloNavigation(): SenloNavigation | null {
  return useContext(NavigationContext);
}
