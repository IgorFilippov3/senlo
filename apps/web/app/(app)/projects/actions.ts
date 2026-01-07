"use server";

import { revalidatePath } from "next/cache";
import { ProjectRepository } from "@senlo/db";
import type { Project } from "@senlo/core";
import { ActionResult, validateId, withErrorHandling } from "apps/web/lib/errors";
import { CreateProjectSchema } from "./schemas";
import { logger } from "apps/web/lib";
import { auth } from "apps/web/auth";

const projectRepository = new ProjectRepository();

export async function listProjects(): Promise<ActionResult<Project[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized', statusCode: 401 } };
  }

  const userId = session.user.id;

  return withErrorHandling(async () => {
    logger.debug("Listing all projects", { userId });
    return await projectRepository.findByUser(userId);
  });
}

export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };
  }

  const parsed = CreateProjectSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const { name, description } = parsed.data;

  try {
    logger.info("Creating new project", {
      name,
      hasDescription: !!description,
      userId: session.user.id,
    });

    const project = await projectRepository.create({
      name,
      description: description || null,
      userId: session.user.id,
    });

    revalidatePath("/projects");

    logger.info("Project created successfully", { projectId: project.id });

    return { success: true, data: project };
  } catch (error) {
    logger.error("Failed to create project", {
      error: error instanceof Error ? error.message : String(error),
      name,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create project"] },
      },
    };
  }
}

export async function deleteProject(
  projectId: number
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const validId = validateId(projectId, "projectId");

    logger.info("Deleting project", { projectId: validId });

    await projectRepository.delete(validId);
    revalidatePath("/projects");

    logger.info("Project deleted successfully", { projectId: validId });
  });
}
