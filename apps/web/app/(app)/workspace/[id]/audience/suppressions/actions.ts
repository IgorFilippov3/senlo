"use server";

import { revalidatePath } from "next/cache";
import { SuppressionRepository, ContactRepository, db } from "@senlo/db";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";
import { Suppression, AudienceService } from "@senlo/core";

const audienceService = new AudienceService(
  new SuppressionRepository(db),
);

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
    return await audienceService.listAllSuppressions(userId);
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
    return await audienceService.listProjectSuppressions(projectId);
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
    const suppression = await audienceService.getSuppressionById(id);
    if (suppression) {
      await audienceService.removeSuppression(id);
      revalidatePath(
        `/workspace/${suppression.projectId}/audience/suppressions`,
      );
    }
  });
}
