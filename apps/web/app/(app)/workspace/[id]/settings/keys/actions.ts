"use server";

import { revalidatePath } from "next/cache";
import { ApiKeyRepository, ProjectRepository, db } from "@senlo/db";
import {
  ActionResult,
  withErrorHandling,
  validateId,
} from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { ApiKey } from "@senlo/core";
import { SettingsService } from "@senlo/core/src/services/settingsService";
import { auth } from "apps/web/auth";

const settingsService = new SettingsService(
  new ApiKeyRepository(db),
  new ProjectRepository(db),
);

const projectRepo = new ProjectRepository(db);

async function authorizeProject(projectId: number) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const project = await projectRepo.findById(projectId);
  if (!project || project.userId !== userId) {
    throw new Error("Unauthorized");
  }

  return { project, userId, session };
}

export async function listApiKeys(
  projectId: number,
): Promise<ActionResult<ApiKey[]>> {
  return withErrorHandling(async () => {
    const validProjectId = validateId(projectId, "projectId");
    await authorizeProject(validProjectId);
    logger.debug("Listing API keys", { projectId: validProjectId });

    return await settingsService.listApiKeys(validProjectId);
  });
}

export async function createApiKey(
  projectId: number,
  name: string,
): Promise<ActionResult<ApiKey>> {
  return withErrorHandling(async () => {
    const validProjectId = validateId(projectId, "projectId");
    await authorizeProject(validProjectId);

    if (!name || name.trim().length === 0) {
      throw new Error("API key name is required");
    }

    if (name.trim().length > 255) {
      throw new Error("API key name too long (max 255 characters)");
    }

    logger.info("Creating API key", {
      projectId: validProjectId,
      name: name.trim(),
    });

    const apiKey = await settingsService.createApiKey(
      validProjectId,
      name.trim(),
    );

    revalidatePath(`/workspace/${validProjectId}/settings/keys`);

    logger.info("API key created successfully", { apiKeyId: apiKey.id });

    return apiKey;
  });
}

export async function deleteApiKey(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const validId = validateId(id, "apiKeyId");

    // Check ownership via project
    const apiKey = await settingsService.getApiKeyById(validId);
    if (!apiKey) throw new Error("API key not found");

    await authorizeProject(apiKey.projectId);

    logger.info("Deleting API key", { apiKeyId: validId });

    await settingsService.deleteApiKey(validId);
    revalidatePath(`/workspace/${apiKey.projectId}/settings/keys`);

    logger.info("API key deleted successfully", { apiKeyId: validId });
  });
}
