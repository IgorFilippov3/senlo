"use server";

import { revalidatePath } from "next/cache";
import type { Suppression } from "@senlo/core";
import { ActionResult, withErrorHandling } from "@senlo/next";
import { requireUserId } from "@/lib/session";
import { getServices } from "@/lib/services";

export async function listProjectSuppressions(
  projectId: number,
): Promise<ActionResult<Suppression[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().audience.listProjectSuppressions(userId, projectId);
  });
}

export async function deleteSuppressionAction(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const { projectId } = await getServices().audience.removeSuppression(userId, id);
    revalidatePath(`/workspace/${projectId}/audience/suppressions`);
  });
}
