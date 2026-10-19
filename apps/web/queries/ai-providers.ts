import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicAiProvider } from "@senlo/core";
import {
  listAiProviders,
  createAiProviderAction,
  deleteAiProviderAction,
  toggleAiProviderAction,
} from "../app/(app)/providers/ai-actions";
import { queryKeys } from "../providers/query-keys";
import { unwrap, unwrapForm } from "./result";

export function useAiProviders() {
  return useQuery({
    queryKey: queryKeys.aiProviders.list(),
    queryFn: async () => unwrap(await listAiProviders()),
  });
}

function useInvalidateAiProviders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders.lists() });
}

/** Rejects with the message to show when the form does not validate. */
export function useCreateAiProvider() {
  const invalidate = useInvalidateAiProviders();
  return useMutation({
    mutationFn: async (formData: FormData) =>
      unwrapForm(await createAiProviderAction(formData), ["name", "type", "apiKey", "model"]),
    onSettled: invalidate,
  });
}

export function useDeleteAiProvider() {
  const invalidate = useInvalidateAiProviders();
  return useMutation({
    mutationFn: async (providerId: number) => {
      unwrap(await deleteAiProviderAction(providerId));
      return providerId;
    },
    onSettled: invalidate,
  });
}

export function useToggleAiProvider() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAiProviders();
  return useMutation({
    mutationFn: async ({ providerId, isActive }: { providerId: number; isActive: boolean }) =>
      unwrap(await toggleAiProviderAction(providerId, isActive)),
    onSuccess: (provider) => {
      queryClient.setQueryData<PublicAiProvider[]>(queryKeys.aiProviders.list(), (old) =>
        old?.map((p) => (p.id === provider.id ? provider : p)),
      );
    },
    onSettled: invalidate,
  });
}
