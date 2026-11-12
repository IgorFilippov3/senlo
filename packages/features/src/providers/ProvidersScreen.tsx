// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useAiProviders, useProviders } from "../data/providers";
import { useSenloDialogs } from "../dialogs/registry";
import { ProvidersView } from "./ProvidersView";

/** The providers page over the data layer and the dialogs. */
export function ProvidersScreen() {
  const email = useProviders();
  const ai = useAiProviders();
  const { open: openDialog } = useSenloDialogs();

  return (
    <ProvidersView
      emailProviders={email.data ?? []}
      aiProviders={ai.data ?? []}
      isLoading={email.isLoading || ai.isLoading}
      error={(email.error ?? ai.error)?.message}
      onRetry={() => {
        email.refetch();
        ai.refetch();
      }}
      onAddEmailProvider={() => openDialog("ADD_PROVIDER", {})}
      onEditEmailProvider={(provider) => openDialog("EDIT_PROVIDER", { provider })}
      onDeleteEmailProvider={(p) => openDialog("DELETE_PROVIDER", { providerId: p.id, name: p.name })}
      onAddAiProvider={() => openDialog("ADD_AI_PROVIDER", {})}
      onDeleteAiProvider={(p) => openDialog("DELETE_AI_PROVIDER", { providerId: p.id, name: p.name })}
    />
  );
}
