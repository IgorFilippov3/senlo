// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { SenloDataProvider, SenloDialogHost, type SenloActions, type SenloPaths } from "@senlo/features";
import { NextNavigationProvider } from "./navigation";

/**
 * Everything the screens need from a Next.js host, in one provider: its
 * navigation (`paths` overrides), its data layer (`actions`, usually
 * `createClientActions(senloAction)`) and the dialog host. Rendered from a
 * client module of the host, since `actions` holds functions. A host with
 * dialogs of its own renders its own `DialogHost` (from `createDialogs`)
 * among the children.
 */
export function SenloAppProvider({
  actions,
  paths,
  children,
}: {
  actions: SenloActions;
  /** A stable object (a module constant); see `NextNavigationProvider`. */
  paths?: Partial<SenloPaths>;
  children: React.ReactNode;
}) {
  return (
    <NextNavigationProvider paths={paths}>
      <SenloDataProvider actions={actions}>
        {children}
        <SenloDialogHost />
      </SenloDataProvider>
    </NextNavigationProvider>
  );
}
