"use server";

import { revalidatePath } from "next/cache";
import { ProjectRepository, ApiKeyRepository, db } from "@senlo/db";
import { Project, SettingsService } from "@senlo/core";
import {
  ActionResult,
  validateId,
  withErrorHandling,
} from "apps/web/lib/errors";
import { CreateWorkspaceSchema } from "./schemas";
import { logger } from "apps/web/lib";
import { auth } from "apps/web/auth";

const settingsService = new SettingsService(
  new ApiKeyRepository(db),
  new ProjectRepository(db),
);

const projectRepository = new ProjectRepository(db);

export async function listWorkspaces(): Promise<ActionResult<Project[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  const userId = session.user.id;

  return withErrorHandling(async () => {
    logger.debug("Listing all workspaces", { userId });
    return await projectRepository.findByUser(userId);
  });
}

export async function createWorkspace(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };
  }

  const parsed = CreateWorkspaceSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const { name, description } = parsed.data;

  try {
    logger.info("Creating new workspace", {
      name,
      hasDescription: !!description,
      userId,
    });

    const project = await projectRepository.create({
      name,
      description: description || null,
      userId,
    });

    revalidatePath("/workspaces");

    logger.info("Workspace created successfully", { projectId: project.id });

    return { success: true, data: project };
  } catch (error) {
    logger.error("Failed to create workspace", {
      error: error instanceof Error ? error.message : String(error),
      name,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create workspace"] },
      },
    };
  }
}

export async function deleteWorkspace(
  projectId: number,
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
    const validId = validateId(projectId, "projectId");

    // Check ownership
    const project = await settingsService.getWorkspace(validId);
    if (!project || project.userId !== userId) {
      throw new Error("Workspace not found or unauthorized");
    }

    logger.info("Deleting workspace", { projectId: validId, userId });

    await settingsService.deleteWorkspace(validId);
    revalidatePath("/workspaces");

    logger.info("Workspace deleted successfully", { projectId: validId });
  });
}

export async function getWorkspace(
  projectId: number,
): Promise<ActionResult<Project>> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    const validId = validateId(projectId, "projectId");
    const project = await settingsService.getWorkspace(validId);

    if (!project || project.userId !== userId) {
      throw new Error("Workspace not found or unauthorized");
    }

    return project;
  });
}
