"use server";

import { revalidatePath } from "next/cache";
import type { Suppression } from "@senlo/core";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

export async function listAllSuppressions(): Promise<
  ActionResult<(Suppression & { projectName: string })[]>
> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().audience.listAllSuppressions(userId);
  });
}

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
