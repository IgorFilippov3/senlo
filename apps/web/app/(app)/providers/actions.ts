"use server";

import { revalidatePath } from "next/cache";
import type { EmailProvider } from "@senlo/core";
import type { EmailProviderField } from "@senlo/core/server";
import {
  ActionResult,
  FormActionResult,
  withErrorHandling,
  withFormErrors,
} from "apps/web/lib/errors";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

export type CreateProviderResult = FormActionResult<EmailProvider, EmailProviderField>;
export type CreateProviderError = Extract<CreateProviderResult, { error: unknown }>;
export type UpdateProviderResult = CreateProviderResult;

export async function listProviders(): Promise<ActionResult<EmailProvider[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().emailProvider.listForUser(userId);
  });
}

export async function createProviderAction(
  formData: FormData,
): Promise<CreateProviderResult> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const provider = await getServices().emailProvider.create(
      userId,
      Object.fromEntries(formData),
    );
    revalidatePath("/providers");
    return provider;
  });
}

export async function updateProviderAction(
  id: number,
  formData: FormData,
): Promise<UpdateProviderResult> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const provider = await getServices().emailProvider.update(
      userId,
      id,
      Object.fromEntries(formData),
    );
    revalidatePath("/providers");
    return provider;
  });
}

export async function toggleProviderAction(
  id: number,
  isActive: boolean,
): Promise<ActionResult<EmailProvider>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const provider = await getServices().emailProvider.setActive(userId, id, isActive);
    revalidatePath("/providers");
    return provider;
  });
}

export async function deleteProviderAction(
  id: number,
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    await getServices().emailProvider.delete(userId, id);
    revalidatePath("/providers");
  });
}
