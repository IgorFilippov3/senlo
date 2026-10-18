"use server";

import { revalidatePath } from "next/cache";
import {
  ActionResult,
  withErrorHandling,
  validateId,
} from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { ApiKey } from "@senlo/core";
import { auth } from "apps/web/auth";
import { getServices, repositories } from "apps/web/lib/services";

const projectRepo = repositories.projects;

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

    return await getServices().settings.listApiKeys(validProjectId);
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

    const apiKey = await getServices().settings.createApiKey(
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
    const apiKey = await getServices().settings.getApiKeyById(validId);
    if (!apiKey) throw new Error("API key not found");

    await authorizeProject(apiKey.projectId);

    logger.info("Deleting API key", { apiKeyId: validId });

    await getServices().settings.deleteApiKey(validId);
    revalidatePath(`/workspace/${apiKey.projectId}/settings/keys`);

    logger.info("API key deleted successfully", { apiKeyId: validId });
  });
}
