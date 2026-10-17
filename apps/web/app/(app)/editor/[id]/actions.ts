"use server";

import { revalidatePath } from "next/cache";
import {
  EmailTemplateRepository, EmailProviderRepository, SavedRowRepository, db } from "@senlo/db";
import {
  EmailDesignDocument,
  renderEmailDesign,
  SavedRow,
  RowBlock,
} from "@senlo/core";
import { emailQueue } from "@senlo/core/src/queue";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";
import { access } from "apps/web/lib/access";
import { requireUserId } from "apps/web/lib/session";

const repo = new EmailTemplateRepository(db);
const providerRepo = new EmailProviderRepository(db);
const savedRowRepo = new SavedRowRepository(db);

async function authorizeTemplate(templateId: number) {
  const userId = await requireUserId();
  const template = await access.requireInProject(
    userId,
    await repo.findById(templateId),
    "Template",
  );
  const project = await access.requireProject(userId, template.projectId);
  return { template, project, userId };
}

// One plain address: no display name, no list, and nothing that could end a
// header line. Both addresses below come straight from the client.
const SINGLE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

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
    const { template } = await authorizeTemplate(id);

    await repo.update({
      id,
      designJson: design,
      html,
      name: metadata?.name,
      subject: metadata?.subject,
      locale: metadata?.locale,
      preheader: metadata?.preheader,
    });

    revalidatePath(`/workspace/${template.projectId}/templates`);
    revalidatePath(`/editor/${id}`);

    return { success: true };
  } catch (error) {
    logger.error("Failed to save template from editor", {
      templateId: id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // The detail is in the log above; the client gets a generic message so
    // driver output and internal paths do not reach the browser.
    return {
      success: false,
      error: "Could not save the template. Please try again.",
    };
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
    const { template, project, userId } = await authorizeTemplate(templateId);

    if (!SINGLE_ADDRESS.test(targetEmail)) {
      throw new Error("Enter a single valid recipient address.");
    }
    if (fromEmail && !SINGLE_ADDRESS.test(fromEmail)) {
      throw new Error("Enter a single valid sender address.");
    }

    if (!project.providerId) {
      throw new Error(
        "No email provider configured for this project. Please set one in Project Settings.",
      );
    }

    const provider = await providerRepo.findById(project.providerId);
    if (!provider || provider.userId !== userId) {
      throw new Error("Email provider not found. It may have been deleted.");
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const personalizedHtml = renderEmailDesign(design, {
      baseUrl,
      data: {
        contact: {
          email: targetEmail,
          name: "Test Recipient",
          first_name: "Test",
          last_name: "Recipient",
        },
        project: { name: project.name },
        unsubscribeUrl: "#test-unsubscribe",
      },
    });

    const job = await emailQueue.add(`test-email-${templateId}-${Date.now()}`, {
      projectId: project.id,
      campaignId: 0, // 0 for test emails
      contactId: 0, // 0 for test emails
      email: targetEmail,
      from: fromEmail || "hello@senlo.io",
      subject: `[TEST] ${subject || template.subject || "No Subject"}`,
      html: personalizedHtml,
      providerId: project.providerId,
    });

    const workers = await emailQueue.getWorkers();
    if (workers.length === 0) {
      logger.warn(
        "Test email added to queue but NO active workers found. Is the worker running?",
      );
    }

    logger.info("Test email queued successfully", {
      jobId: job.id,
      templateId,
      targetEmail,
      activeWorkers: workers.length,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error("Failed to send test email from editor", {
      templateId,
      targetEmail,
      error: errorMessage,
      stack: errorStack,
    });
    return { success: false, error: errorMessage };
  }
}

export async function listSavedRowsAction(): Promise<SavedRow[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  return savedRowRepo.findByUser(userId);
}

export async function saveRowAction(
  name: string,
  data: RowBlock,
  projectId?: number,
): Promise<{ success: boolean; data?: SavedRow }> {
  try {
    const userId = await requireUserId();
    if (projectId) {
      await access.requireProject(userId, projectId);
    }

    const savedRow = await savedRowRepo.create({
      name,
      data,
      userId,
      projectId: projectId || null,
    });

    return { success: true, data: savedRow };
  } catch (error) {
    logger.error("Failed to save row", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false };
  }
}

export async function deleteSavedRowAction(
  id: number,
): Promise<{ success: boolean }> {
  try {
    const userId = await requireUserId();
    access.requireUserOwned(userId, await savedRowRepo.findById(id), "Saved row");

    await savedRowRepo.delete(id);
    return { success: true };
  } catch (error) {
    logger.error("Failed to delete saved row", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false };
  }
}
