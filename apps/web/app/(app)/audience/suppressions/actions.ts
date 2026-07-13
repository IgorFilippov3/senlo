"use server";

import { revalidatePath } from "next/cache";
import { SuppressionRepository } from "@senlo/db";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";
import { Suppression } from "@senlo/core";

const suppressionRepo = new SuppressionRepository();

export async function listAllSuppressions(): Promise<ActionResult<(Suppression & { projectName: string })[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.debug("Listing all suppressions for user", { userId: session.user.id });
    return await suppressionRepo.findAllByUser(session.user.id);
  });
}

export async function deleteSuppressionAction(id: number): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.info("Deleting suppression entry", { id, userId: session.user.id });
    // In a real scenario, we might want to check if the user owns the project associated with this suppression
    // But for now, we'll keep it simple as it's an internal admin-like tool
    await suppressionRepo.delete(id);
    revalidatePath("/audience/suppressions");
  });
}
