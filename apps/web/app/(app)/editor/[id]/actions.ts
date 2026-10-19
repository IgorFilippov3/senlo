"use server";

import { revalidatePath } from "next/cache";
import { AppError, type EmailDesignDocument, type RowBlock, type SavedRow } from "@senlo/core";
import { logger } from "apps/web/lib/logger";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

export async function saveTemplateFromEditor(
  id: number,
  design: EmailDesignDocument,
  html: string,
  metadata?: {
    name: string;
    subject: string;
    locale?: string;
    preheader?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await requireUserId();
    const template = await getServices().template.saveFromEditor(userId, id, {
      design,
      html,
      metadata,
    });
    revalidatePath(`/workspace/${template.projectId}/templates`);
    revalidatePath(`/editor/${id}`);
    return { success: true };
  } catch (error) {
    logger.error("Failed to save template from editor", {
      templateId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    // The detail is in the log; the client gets a generic message so driver
    // output and internal paths do not reach the browser.
    return { success: false, error: "Could not save the template. Please try again." };
  }
}

export async function sendTestEmailAction(
  templateId: number,
  targetEmail: string,
  fromEmail: string,
  design: EmailDesignDocument,
  subject: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await requireUserId();
    const { activeWorkers } = await getServices().template.sendTest(userId, templateId, {
      to: targetEmail,
      from: fromEmail,
      design,
      subject,
    });
    if (activeWorkers === 0) {
      logger.warn("Test email queued but no active workers found. Is the worker running?");
    }
    return { success: true };
  } catch (error) {
    logger.error("Failed to send test email from editor", {
      templateId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Typed errors carry a message meant for the user; anything else stays in the log.
    const message = error instanceof AppError ? error.message : "Could not send the test email.";
    return { success: false, error: message };
  }
}

export async function listSavedRowsAction(): Promise<SavedRow[]> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return [];
  return getServices().savedRow.list(userId);
}

export async function saveRowAction(
  name: string,
  data: RowBlock,
  projectId?: number,
): Promise<{ success: boolean; data?: SavedRow }> {
  try {
    const userId = await requireUserId();
    const savedRow = await getServices().savedRow.save(userId, { name, data, projectId });
    return { success: true, data: savedRow };
  } catch (error) {
    logger.error("Failed to save row", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false };
  }
}

export async function deleteSavedRowAction(id: number): Promise<{ success: boolean }> {
  try {
    const userId = await requireUserId();
    await getServices().savedRow.delete(userId, id);
    return { success: true };
  } catch (error) {
    logger.error("Failed to delete saved row", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false };
  }
}
