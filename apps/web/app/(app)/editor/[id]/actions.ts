"use server";

import { revalidatePath } from "next/cache";
import {
  EmailTemplateRepository,
  EmailProviderRepository,
  ProjectRepository,
} from "@senlo/db";
import { EmailDesignDocument, renderEmailDesign } from "@senlo/core";
import { emailQueue } from "@senlo/core/src/queue";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";

const repo = new EmailTemplateRepository();
const providerRepo = new EmailProviderRepository();
const projectRepo = new ProjectRepository();

async function authorizeTemplate(templateId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const template = await repo.findById(templateId);
  if (!template) throw new Error("Template not found");

  const project = await projectRepo.findById(template.projectId);
  if (!project || project.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  return { template, project, session };
}

export async function saveTemplateFromEditor(
  id: number,
  design: EmailDesignDocument,
  html: string,
  metadata?: { name: string; subject: string }
): Promise<{ success: boolean }> {
  try {
    const { template } = await authorizeTemplate(id);

    await repo.update({
      id,
      designJson: design,
      html,
      name: metadata?.name,
      subject: metadata?.subject,
    });

    revalidatePath(`/projects/${template.projectId}`);
    revalidatePath(`/editor/${id}`);

    return { success: true };
  } catch (error) {
    logger.error("Failed to save template from editor", {
      templateId: id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false };
  }
}

export async function sendTestEmailAction(
  templateId: number,
  targetEmail: string,
  fromEmail: string,
  design: EmailDesignDocument,
  subject: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { template, project } = await authorizeTemplate(templateId);

    if (!project.providerId) {
      throw new Error(
        "No email provider configured for this project. Please set one in Project Settings."
      );
    }

    const provider = await providerRepo.findById(project.providerId);
    if (!provider) {
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
      logger.warn("Test email added to queue but NO active workers found. Is the worker running?");
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
