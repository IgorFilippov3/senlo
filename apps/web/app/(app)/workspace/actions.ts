"use server";

import { revalidatePath } from "next/cache";
import type { Project } from "@senlo/core";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "@senlo/core/server";
import {
  ActionResult,
  FormActionResult,
  withErrorHandling,
  withFormErrors,
} from "@senlo/next";
import { requireUserId } from "@/lib/session";
import { getServices } from "@/lib/services";

export async function listWorkspaces(): Promise<ActionResult<Project[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().project.listForUser(userId);
  });
}

export async function getWorkspace(projectId: number): Promise<ActionResult<Project>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().project.require(userId, projectId, "read");
  });
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<FormActionResult<Project, keyof CreateWorkspaceInput | "general">> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const project = await getServices().project.create(userId, input);
    revalidatePath("/workspaces");
    return project;
  });
}

export async function updateWorkspace(
  projectId: number,
  input: UpdateWorkspaceInput,
): Promise<FormActionResult<Project, keyof UpdateWorkspaceInput | "general">> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const project = await getServices().project.update(userId, projectId, input);
    revalidatePath(`/workspace/${projectId}`, "layout");
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
