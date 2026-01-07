"use server";

import { revalidatePath } from "next/cache";
import { ApiKeyRepository, ProjectRepository } from "@senlo/db";
import { nanoid } from "nanoid";
import {
  ActionResult,
  withErrorHandling,
  validateId,
} from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { ApiKey } from "@senlo/core";
import { auth } from "apps/web/auth";

const apiKeyRepository = new ApiKeyRepository();
const projectRepo = new ProjectRepository();

async function authorizeProject(projectId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const project = await projectRepo.findById(projectId);
  if (!project || project.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  return { project, session };
}

export async function listApiKeys(
  projectId: number
): Promise<ActionResult<ApiKey[]>> {
  return withErrorHandling(async () => {
    const validProjectId = validateId(projectId, "projectId");
    await authorizeProject(validProjectId);
    logger.debug("Listing API keys", { projectId: validProjectId });

    return apiKeyRepository.findByProject(validProjectId);
  });
}

export async function createApiKey(
  projectId: number,
  name: string
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

    const key = `snl_${nanoid(32)}`;

    logger.info("Creating API key", {
      projectId: validProjectId,
      name: name.trim(),
    });

    const apiKey = await apiKeyRepository.create({
      projectId: validProjectId,
      name: name.trim(),
      key,
    });

    revalidatePath("/settings/keys");

    logger.info("API key created successfully", { apiKeyId: apiKey.id });

    return apiKey;
  });
}

export async function deleteApiKey(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const validId = validateId(id, "apiKeyId");
    
    // Check ownership via project
    const apiKey = await apiKeyRepository.findById(validId);
    if (!apiKey) throw new Error("API key not found");
    
    await authorizeProject(apiKey.projectId);

    logger.info("Deleting API key", { apiKeyId: validId });

    await apiKeyRepository.delete(validId);
    revalidatePath("/settings/keys");

    logger.info("API key deleted successfully", { apiKeyId: validId });
  });
}
