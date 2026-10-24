// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SenloNavigationProvider,
  senloPaths,
  type SenloNavigation,
  type SenloPaths,
} from "@senlo/features";
import { nextRenderLink } from "./link";

/**
 * The features navigation port on the App Router. `paths` are the host's
 * URL overrides; whatever it leaves out stays at self-hosted's URLs. Pass a
 * stable object (a module constant): a new one every render rebuilds the
 * navigation for every screen under it.
 */
export function NextNavigationProvider({
  paths,
  children,
}: {
  paths?: Partial<SenloPaths>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const resolved = useMemo(() => senloPaths(paths), [paths]);

  const value = useMemo<SenloNavigation>(
    () => ({
      paths: resolved,
      pathname,
      renderLink: nextRenderLink,
      push: (href) => router.push(href),
      replace: (href) => router.replace(href),
      refresh: () => router.refresh(),
    }),
    [resolved, pathname, router],
  );

  return <SenloNavigationProvider value={value}>{children}</SenloNavigationProvider>;
}
