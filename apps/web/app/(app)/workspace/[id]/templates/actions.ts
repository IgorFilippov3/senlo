"use server";

import { revalidatePath } from "next/cache";
import type { EmailTemplate } from "@senlo/core";
import { ActionResult, validateId, withErrorHandling } from "apps/web/lib/errors";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

export async function listProjectTemplates(projectId: number): Promise<ActionResult<EmailTemplate[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().template.listProjectTemplates(userId, validateId(projectId, "projectId"));
  });
}

export async function createTemplate(
  projectId: number,
  input: Record<string, unknown>,
): Promise<ActionResult<EmailTemplate>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const template = await getServices().template.create(
      userId,
      validateId(projectId, "projectId"),
      input,
    );
    revalidatePath(`/workspace/${projectId}/templates`);
    return template;
  });
}

export async function deleteTemplate(
  projectId: number,
  templateId: number,
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    await getServices().template.delete(userId, validateId(projectId, "projectId"), templateId);
    revalidatePath(`/workspace/${projectId}/templates`);
  });
}
