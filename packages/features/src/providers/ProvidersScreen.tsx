// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useAiProviders, useProviders, useToggleAiProvider, useToggleProvider } from "../data/providers";
import { useSenloDialogs } from "../dialogs/registry";
import { ProvidersView } from "./ProvidersView";

/** The providers page over the data layer and the dialogs. */
export function ProvidersScreen() {
  const email = useProviders();
  const ai = useAiProviders();
  const toggleEmail = useToggleProvider();
  const toggleAi = useToggleAiProvider();
  const { open: openDialog } = useSenloDialogs();

  // Each toggle replaces its mutation's state, so a later success clears the message.
  const actionError = toggleEmail.error
    ? "Failed to update provider status. Please try again."
    : toggleAi.error
      ? "Failed to update AI provider status. Please try again."
      : null;

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
      actionError={actionError}
      onAddEmailProvider={() => openDialog("ADD_PROVIDER", {})}
      onEditEmailProvider={(provider) => openDialog("EDIT_PROVIDER", { provider })}
      onDeleteEmailProvider={(p) => openDialog("DELETE_PROVIDER", { providerId: p.id, name: p.name })}
      onToggleEmailProvider={(p, isActive) => {
        toggleAi.reset();
        toggleEmail.mutate({ providerId: p.id, isActive });
      }}
      onAddAiProvider={() => openDialog("ADD_AI_PROVIDER", {})}
      onDeleteAiProvider={(p) => openDialog("DELETE_AI_PROVIDER", { providerId: p.id, name: p.name })}
      onToggleAiProvider={(p, isActive) => {
        toggleEmail.reset();
        toggleAi.mutate({ providerId: p.id, isActive });
      }}
    />
  );
}
