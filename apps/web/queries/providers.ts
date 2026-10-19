import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicEmailProvider } from "@senlo/core";
import {
  listProviders,
  createProviderAction,
  deleteProviderAction,
  toggleProviderAction,
  updateProviderAction,
} from "../app/(app)/providers/actions";
import { queryKeys } from "../providers";
import { unwrap, unwrapForm } from "./result";

/** Form fields in the order the provider dialog shows them. */
const PROVIDER_FIELDS = [
  "name",
  "type",
  "apiKey",
  "webhookSecret",
  "domain",
  "region",
  "accessKeyId",
  "secretAccessKey",
  "serverToken",
  "host",
  "port",
  "encryption",
  "username",
  "password",
];

export function useProviders() {
  return useQuery({
    queryKey: queryKeys.emailProviders.list(),
    queryFn: async () => unwrap(await listProviders()),
  });
}

function useInvalidateProviders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.emailProviders.lists() });
}

/** Rejects with the message to show when the form does not validate. */
export function useCreateProvider() {
  const invalidate = useInvalidateProviders();
  return useMutation({
    mutationFn: async (formData: FormData) =>
      unwrapForm(await createProviderAction(formData), PROVIDER_FIELDS),
    onSettled: invalidate,
  });
}

/** Rejects with the message to show when the form does not validate. */
export function useUpdateProvider() {
  const invalidate = useInvalidateProviders();
  return useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: FormData }) =>
      unwrapForm(await updateProviderAction(id, formData), PROVIDER_FIELDS),
    onSettled: invalidate,
  });
}

export function useDeleteProvider() {
  const invalidate = useInvalidateProviders();
  return useMutation({
    mutationFn: async (providerId: number) => {
      unwrap(await deleteProviderAction(providerId));
      return providerId;
    },
    onSettled: invalidate,
  });
}

export function useToggleProvider() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProviders();
  return useMutation({
    mutationFn: async ({ providerId, isActive }: { providerId: number; isActive: boolean }) =>
      unwrap(await toggleProviderAction(providerId, isActive)),
    onSuccess: (provider) => {
      queryClient.setQueryData<PublicEmailProvider[]>(queryKeys.emailProviders.list(), (old) =>
        old?.map((p) => (p.id === provider.id ? provider : p)),
      );
    },
    onSettled: invalidate,
  });
}
