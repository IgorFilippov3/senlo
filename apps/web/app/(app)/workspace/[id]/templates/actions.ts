"use server";

import { revalidatePath } from "next/cache";
import type { EmailTemplate } from "@senlo/core";
import { ActionResult, validateId, withErrorHandling } from "apps/web/lib/errors";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

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
