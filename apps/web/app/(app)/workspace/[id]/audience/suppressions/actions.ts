"use server";

import { revalidatePath } from "next/cache";
import { SuppressionRepository, db } from "@senlo/db";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";
import { Suppression } from "@senlo/core";

const suppressionRepo = new SuppressionRepository(db);

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
    return await suppressionRepo.findAllByUser(userId);
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
    logger.debug("Listing suppressions for project", { projectId, userId });
    return await suppressionRepo.findByProject(projectId);
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
    const suppression = await suppressionRepo.findById(id);
    if (suppression) {
      await suppressionRepo.delete(id);
      revalidatePath(
        `/workspace/${suppression.projectId}/audience/suppressions`,
      );
    }
  });
}
