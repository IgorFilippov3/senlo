"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicAiProvider, PublicEmailProvider } from "@senlo/core";
import type { EmailProviderValues } from "../providers/EmailProviderDialog";
import type { AiProviderValues } from "../providers/AiProviderDialog";
import { useSenloActions } from "./provider";
import { queryKeys } from "./query-keys";
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
const AI_PROVIDER_FIELDS = ["name", "type", "apiKey", "model"];

// Email providers

export function useProviders() {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.emailProviders.list(),
    queryFn: async () => unwrap(await actions.emailProviders.list()),
  });
}

function useInvalidate(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey });
}

/** Rejects with the message to show when the form does not validate. */
export function useCreateProvider() {
  const actions = useSenloActions();
  const invalidate = useInvalidate(queryKeys.emailProviders.all);
  return useMutation({
    mutationFn: async (values: EmailProviderValues) =>
      unwrapForm(await actions.emailProviders.create(values), PROVIDER_FIELDS),
    onSettled: invalidate,
  });
}

/** Rejects with the message to show when the form does not validate. */
export function useUpdateProvider() {
  const actions = useSenloActions();
  const invalidate = useInvalidate(queryKeys.emailProviders.all);
  return useMutation({
    mutationFn: async ({ id, values }: { id: number; values: EmailProviderValues }) =>
      unwrapForm(await actions.emailProviders.update(id, values), PROVIDER_FIELDS),
    onSettled: invalidate,
  });
}

export function useDeleteProvider() {
  const actions = useSenloActions();
  const invalidate = useInvalidate(queryKeys.emailProviders.all);
  return useMutation({
    mutationFn: async (providerId: number) => {
      unwrap(await actions.emailProviders.delete(providerId));
      return providerId;
    },
    onSettled: invalidate,
  });
}

export function useToggleProvider() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate(queryKeys.emailProviders.all);
  return useMutation({
    mutationFn: async ({ providerId, isActive }: { providerId: number; isActive: boolean }) =>
      unwrap(await actions.emailProviders.toggle(providerId, isActive)),
    onSuccess: (provider) => {
      queryClient.setQueryData<PublicEmailProvider[]>(queryKeys.emailProviders.list(), (old) =>
        old?.map((p) => (p.id === provider.id ? provider : p)),
      );
    },
    onSettled: invalidate,
  });
}

// AI providers

export function useAiProviders() {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.aiProviders.list(),
    queryFn: async () => unwrap(await actions.aiProviders.list()),
  });
}

/** Rejects with the message to show when the form does not validate. */
export function useCreateAiProvider() {
  const actions = useSenloActions();
  const invalidate = useInvalidate(queryKeys.aiProviders.all);
  return useMutation({
    mutationFn: async (values: AiProviderValues) =>
      unwrapForm(await actions.aiProviders.create(values), AI_PROVIDER_FIELDS),
    onSettled: invalidate,
  });
}

export function useDeleteAiProvider() {
  const actions = useSenloActions();
  const invalidate = useInvalidate(queryKeys.aiProviders.all);
  return useMutation({
    mutationFn: async (providerId: number) => {
      unwrap(await actions.aiProviders.delete(providerId));
      return providerId;
    },
    onSettled: invalidate,
  });
}

export function useToggleAiProvider() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate(queryKeys.aiProviders.all);
  return useMutation({
    mutationFn: async ({ providerId, isActive }: { providerId: number; isActive: boolean }) =>
      unwrap(await actions.aiProviders.toggle(providerId, isActive)),
    onSuccess: (provider) => {
      queryClient.setQueryData<PublicAiProvider[]>(queryKeys.aiProviders.list(), (old) =>
        old?.map((p) => (p.id === provider.id ? provider : p)),
      );
    },
    onSettled: invalidate,
  });
}
