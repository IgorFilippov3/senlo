"use server";

import { revalidatePath } from "next/cache";
import type { PublicAiProvider } from "@senlo/core";
import type { AiProviderInput } from "@senlo/core/server";
import {
  ActionResult,
  FormActionResult,
  withErrorHandling,
  withFormErrors,
} from "apps/web/lib/errors";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

export type CreateAiProviderResult = FormActionResult<
  PublicAiProvider,
  keyof AiProviderInput | "general"
>;

export async function listAiProviders(): Promise<ActionResult<PublicAiProvider[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().aiProvider.listForUser(userId);
  });
}

export async function createAiProviderAction(
  input: Record<string, unknown>,
): Promise<CreateAiProviderResult> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const provider = await getServices().aiProvider.create(
      userId,
      input,
    );
    revalidatePath("/providers");
    return provider;
  });
}

export async function toggleAiProviderAction(
  id: number,
  isActive: boolean,
): Promise<ActionResult<PublicAiProvider>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const provider = await getServices().aiProvider.setActive(userId, id, isActive);
    revalidatePath("/providers");
    return provider;
  });
}

export async function deleteAiProviderAction(
  id: number,
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    await getServices().aiProvider.delete(userId, id);
    revalidatePath("/providers");
  });
}
