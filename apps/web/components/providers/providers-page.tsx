"use client";

import {
  ProvidersView,
  useProviders,
  useToggleProvider,
  useAiProviders,
  useToggleAiProvider,
} from "@senlo/features";
import { useDialogs } from "@/providers/dialogs/store";

export function ProvidersPage() {
  const email = useProviders();
  const ai = useAiProviders();
  const toggleEmail = useToggleProvider();
  const toggleAi = useToggleAiProvider();
  const { open: openDialog } = useDialogs();

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
      onToggleEmailProvider={(p, isActive) =>
        toggleEmail.mutate(
          { providerId: p.id, isActive },
          { onError: () => alert("Failed to update provider status. Please try again.") },
        )
      }
      onAddAiProvider={() => openDialog("ADD_AI_PROVIDER", {})}
      onDeleteAiProvider={(p) => openDialog("DELETE_AI_PROVIDER", { providerId: p.id, name: p.name })}
      onToggleAiProvider={(p, isActive) =>
        toggleAi.mutate(
          { providerId: p.id, isActive },
          { onError: () => alert("Failed to update AI provider status. Please try again.") },
        )
      }
    />
  );
}
