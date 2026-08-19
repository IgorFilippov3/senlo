"use server";

import { revalidatePath } from "next/cache";
import {
  SuppressionRepository,
  ContactRepository,
  WorkflowRepository,
  WorkflowExecutionRepository,
  CampaignRepository,
  EmailTemplateRepository,
  EmailProviderRepository,
  ProjectRepository,
  TriggeredSendLogRepository,
  db,
} from "@senlo/db";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { auth } from "apps/web/auth";
import { Suppression } from "@senlo/core";
import { AudienceService } from "@senlo/core/src/services/audienceService";
import { AutomationService } from "@senlo/core/src/services/automationService";
import { TriggerService } from "@senlo/core/src/services/triggerService";
import { automationQueue, emailQueue } from "@senlo/core/src/queue";

const suppressionRepo = new SuppressionRepository(db);
const contactRepo = new ContactRepository(db);
const workflowRepo = new WorkflowRepository(db);
const executionRepo = new WorkflowExecutionRepository(db);
const campaignRepo = new CampaignRepository(db);
const templateRepo = new EmailTemplateRepository(db);
const providerRepo = new EmailProviderRepository(db);
const projectRepo = new ProjectRepository(db);
const logRepo = new TriggeredSendLogRepository(db);

const triggerService = new TriggerService(
  campaignRepo,
  templateRepo,
  providerRepo,
  projectRepo,
  logRepo,
  emailQueue,
);

const automationService = new AutomationService(
  workflowRepo,
  executionRepo,
  contactRepo,
  automationQueue,
  triggerService,
);

const audienceService = new AudienceService(
  suppressionRepo,
  contactRepo,
  workflowRepo,
  automationService,
);

export async function listAllSuppressions(): Promise<
  ActionResult<(Suppression & { projectName: string })[]>
> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.debug("Listing all suppressions for user", { userId });
    return await audienceService.listAllSuppressions(userId);
  });
}

export async function listProjectSuppressions(
  projectId: number,
): Promise<ActionResult<Suppression[]>> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.debug("Listing suppressions for project", { projectId, userId });
    return await audienceService.listProjectSuppressions(projectId);
  });
}

export async function deleteSuppressionAction(
  id: number,
): Promise<ActionResult<void>> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };
  }

  return withErrorHandling(async () => {
    logger.info("Deleting suppression entry", { id, userId });
    const suppression = await audienceService.getSuppressionById(id);
    if (suppression) {
      await audienceService.removeSuppression(id);
      revalidatePath(
        `/workspace/${suppression.projectId}/audience/suppressions`,
      );
    }
  });
}
