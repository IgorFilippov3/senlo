"use server";

import { revalidatePath } from "next/cache";
import type { ApiKey, IssuedApiKey } from "@senlo/core";
import { ActionResult, validateId, withErrorHandling } from "@senlo/next";
import { requireUserId } from "@/lib/session";
import { getServices } from "@/lib/services";

export async function listApiKeys(projectId: number): Promise<ActionResult<ApiKey[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().settings.listApiKeys(userId, validateId(projectId, "projectId"));
  });
}

/** The only response that carries the plain key; the list never does. */
export async function createApiKey(
  projectId: number,
  name: string,
): Promise<ActionResult<IssuedApiKey>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const id = validateId(projectId, "projectId");
    const apiKey = await getServices().settings.createApiKey(userId, id, name);
    revalidatePath(`/workspace/${id}/settings/keys`);
    return apiKey;
  });
}

export async function deleteApiKey(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const { projectId } = await getServices().settings.deleteApiKey(userId, validateId(id, "apiKeyId"));
    revalidatePath(`/workspace/${projectId}/settings/keys`);
  });
}
