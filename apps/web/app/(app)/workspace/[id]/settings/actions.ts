"use server";

import { revalidatePath } from "next/cache";
import {
  ProjectRepository,
  ApiKeyRepository,
  EmailProviderRepository,
  db,
} from "@senlo/db";
import { Project } from "@senlo/core";
import { SettingsService } from "@senlo/core/server";
import {
  ActionResult,
  withErrorHandling,
  validateId,
} from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { access } from "apps/web/lib/access";
import { requireUserId } from "apps/web/lib/session";

const settingsService = new SettingsService(
  new ApiKeyRepository(db),
  new ProjectRepository(db),
);
const providerRepo = new EmailProviderRepository(db);

async function getAuthorizedProject(projectId: number) {
  const userId = await requireUserId();
  const project = await access.requireProject(userId, projectId);
  return { project, userId };
}

export async function updateWorkspaceAction(
  id: number,
  data: {
    name?: string;
    description?: string | null;
    providerId?: number | null;
  },
): Promise<ActionResult<Project>> {
  return withErrorHandling(async () => {
    const validId = validateId(id, "workspaceId");
    const { userId } = await getAuthorizedProject(validId);

    // A provider id from the form must be the user's own, or a workspace
    // could be pointed at someone else's credentials.
    if (data.providerId) {
      access.requireUserOwned(
        userId,
        await providerRepo.findById(data.providerId),
        "Email provider",
      );
    }

    logger.info("Updating workspace settings", {
      workspaceId: validId,
      ...data,
    });

    const updatedProject = await settingsService.updateWorkspace(validId, data);
    if (!updatedProject) throw new Error("Failed to update workspace");

    revalidatePath(`/workspace/${validId}/settings`);
    revalidatePath("/workspaces");

    return updatedProject;
  });
}

export async function deleteWorkspaceAction(
  id: number,
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const validId = validateId(id, "workspaceId");
    await getAuthorizedProject(validId);

    logger.info("Deleting workspace", { workspaceId: validId });

    await settingsService.deleteWorkspace(validId);

    revalidatePath("/workspaces");
  });
}
