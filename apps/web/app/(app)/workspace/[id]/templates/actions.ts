"use server";

import { revalidatePath } from "next/cache";
import type { EmailTemplate, Project, PublicAiProvider, PublicEmailProvider } from "@senlo/core";
import { ActionResult, validateId, withErrorHandling } from "apps/web/lib/errors";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

export async function getWorkspaceById(id: string): Promise<ActionResult<Project | null>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().project.require(userId, validateId(id, "projectId"));
  });
}

export async function listProjectTemplates(id: string): Promise<ActionResult<EmailTemplate[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().template.listProjectTemplates(userId, validateId(id, "projectId"));
  });
}

export async function createTemplate(
  projectId: string,
  formData: FormData,
): Promise<ActionResult<EmailTemplate>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const template = await getServices().template.create(
      userId,
      validateId(projectId, "projectId"),
      Object.fromEntries(formData),
    );
    revalidatePath(`/workspace/${projectId}/templates`);
    return template;
  });
}

export async function deleteTemplate(
  projectId: string,
  templateId: number,
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    await getServices().template.delete(userId, validateId(projectId, "projectId"), templateId);
    revalidatePath(`/workspace/${projectId}/templates`);
  });
}

export async function updateWorkspace(id: number, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  await getServices().project.update(userId, id, Object.fromEntries(formData));
  revalidatePath(`/workspace/${id}/templates`);
  revalidatePath(`/workspace/${id}/settings`);
  revalidatePath("/workspaces");
}

export async function listProviders(): Promise<ActionResult<PublicEmailProvider[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().emailProvider.listForUser(userId);
  });
}

export async function listAiProviders(): Promise<ActionResult<PublicAiProvider[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().aiProvider.listForUser(userId);
  });
}
