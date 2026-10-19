"use server";

import { revalidatePath } from "next/cache";
import type { Project } from "@senlo/core";
import type { CreateWorkspaceInput } from "@senlo/core/server";
import {
  ActionResult,
  FormActionResult,
  withErrorHandling,
  withFormErrors,
} from "apps/web/lib/errors";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

export async function listWorkspaces(): Promise<ActionResult<Project[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().project.listForUser(userId);
  });
}

export async function createWorkspace(
  formData: FormData,
): Promise<FormActionResult<Project, keyof CreateWorkspaceInput | "general">> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const project = await getServices().project.create(userId, Object.fromEntries(formData));
    revalidatePath("/workspaces");
    return project;
  });
}

export async function deleteWorkspace(projectId: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    await getServices().project.delete(userId, projectId);
    revalidatePath("/workspaces");
  });
}

export async function getWorkspace(projectId: number): Promise<ActionResult<Project>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().project.require(userId, projectId);
  });
}
