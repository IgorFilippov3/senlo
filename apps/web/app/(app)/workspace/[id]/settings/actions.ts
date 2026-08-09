"use server";

import { revalidatePath } from "next/cache";
import { ProjectRepository, ApiKeyRepository, db } from "@senlo/db";
import { Project } from "@senlo/core";
import { SettingsService } from "@senlo/core/src/services/settingsService";
import {
  ActionResult,
  withErrorHandling,
  validateId,
} from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";

const settingsService = new SettingsService(
  new ApiKeyRepository(db),
  new ProjectRepository(db),
);

async function getAuthorizedProject(projectId: number) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const project = await settingsService.getWorkspace(projectId);
  if (!project) throw new Error("Workspace not found");
  if (project.userId !== userId) throw new Error("Unauthorized");

  return { project, userId, session };
}

export async function updateWorkspaceAction(
  id: number,
  data: {
    name?: string;
    description?: string | null;
  },
): Promise<ActionResult<Project>> {
  return withErrorHandling(async () => {
    const validId = validateId(id, "workspaceId");
    await getAuthorizedProject(validId);

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
