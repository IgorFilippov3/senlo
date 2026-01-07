"use server";

import { revalidatePath } from "next/cache";
import {
  ProjectRepository,
  EmailTemplateRepository,
  EmailProviderRepository,
} from "@senlo/db";
import {
  type Project,
  type EmailTemplate,
  type EmailProvider,
  EMPTY_EMAIL_DESIGN,
} from "@senlo/core";
import {
  ActionResult,
  withErrorHandling,
  validateId,
} from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";

const projectRepo = new ProjectRepository();
const templateRepo = new EmailTemplateRepository();
const providerRepo = new EmailProviderRepository();

async function getAuthorizedProject(projectId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error("Project not found");
  if (project.userId !== session.user.id) throw new Error("Unauthorized");

  return { project, session };
}

export async function getProjectById(
  id: string
): Promise<ActionResult<Project | null>> {
  return withErrorHandling(async () => {
    const projectId = validateId(id, "projectId");
    const { project } = await getAuthorizedProject(projectId);
    return project;
  });
}

export async function listProjectTemplates(
  id: string
): Promise<ActionResult<EmailTemplate[]>> {
  return withErrorHandling(async () => {
    const projectId = validateId(id, "projectId");
    await getAuthorizedProject(projectId);
    logger.debug("Listing project templates", { projectId });

    return templateRepo.findByProject(projectId);
  });
}

export async function createTemplate(
  projectId: string,
  formData: FormData
): Promise<ActionResult<EmailTemplate>> {
  return withErrorHandling(async () => {
    const name = String(formData.get("name") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const numericProjectId = parseInt(projectId, 10);

    await getAuthorizedProject(numericProjectId);

    if (!name || !subject) {
      throw new Error("Name and subject required");
    }

    logger.debug("Creating template", { projectId: numericProjectId, name });

    const template = await templateRepo.create({
      projectId: numericProjectId,
      name,
      subject,
      html: "<p>Empty template</p>",
      designJson: EMPTY_EMAIL_DESIGN,
    });

    revalidatePath(`/projects/${projectId}`);
    
    return template;
  });
}

export async function deleteTemplate(
  projectId: string,
  templateId: number
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const numericProjectId = parseInt(projectId, 10);
    await getAuthorizedProject(numericProjectId);

    logger.debug("Deleting template", { projectId: numericProjectId, templateId });
    
    await templateRepo.delete(templateId);
    revalidatePath(`/projects/${projectId}`);
  });
}

export async function updateProject(
  id: number,
  formData: FormData
): Promise<void> {
  const { session } = await getAuthorizedProject(id);

  const name = String(formData.get("name") || "").trim();
  const descriptionRaw = formData.get("description");
  const description =
    typeof descriptionRaw === "string" && descriptionRaw.trim().length > 0
      ? descriptionRaw.trim()
      : null;

  const providerIdRaw = formData.get("providerId");
  const providerId =
    providerIdRaw && providerIdRaw !== "" ? Number(providerIdRaw) : null;

  if (!name) {
    throw new Error("Project name is required");
  }

  // If setting a provider, verify it belongs to the user
  if (providerId) {
    const provider = await providerRepo.findById(providerId);
    if (!provider || provider.userId !== session.user?.id) {
      throw new Error("Invalid provider");
    }
  }

  await projectRepo.update(id, {
    name,
    description,
    providerId,
  });

  revalidatePath(`/projects/${id}`);
}

export async function listProviders(): Promise<ActionResult<EmailProvider[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized', statusCode: 401 } };
  }

  const userId = session.user.id;

  return withErrorHandling(async () => {
    logger.debug("Listing all email providers for project", { userId });
    return await providerRepo.findByUser(userId);
  });
}
