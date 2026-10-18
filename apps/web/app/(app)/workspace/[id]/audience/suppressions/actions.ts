"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";
import { access } from "apps/web/lib/access";
import { Suppression } from "@senlo/core";
import { getServices } from "apps/web/lib/services";

export async function listAllSuppressions(): Promise<
  ActionResult<(Suppression & { projectName: string })[]>
> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.debug("Listing all suppressions for user", { userId });
    return await getServices().audience.listAllSuppressions(userId);
  });
}

export async function listProjectSuppressions(
  projectId: number,
): Promise<ActionResult<Suppression[]>> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    await access.requireProject(userId, projectId);
    logger.debug("Listing suppressions for project", { projectId, userId });
    return await getServices().audience.listProjectSuppressions(projectId);
  });
}

export async function deleteSuppressionAction(
  id: number,
): Promise<ActionResult<void>> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.info("Deleting suppression entry", { id, userId });
    const suppression = await access.requireInProject(
      userId,
      await getServices().audience.getSuppressionById(id),
      "Suppression",
    );
    await getServices().audience.removeSuppression(id);
    revalidatePath(`/workspace/${suppression.projectId}/audience/suppressions`);
  });
}
