import {
  ContactRepository,
  WorkflowRepository,
  WorkflowExecutionRepository,
  SuppressionRepository,
  CampaignRepository,
  EmailTemplateRepository,
  EmailProviderRepository,
  ProjectRepository,
  TriggeredSendLogRepository,
  db,
} from "@senlo/db";
import {
  AudienceService,
  AutomationService,
  TriggerService,
  WorkflowEventType,
} from "@senlo/core";
import { automationQueue, emailQueue } from "@senlo/core/src/queue";
import { EventHandler } from "./types";

// Initialize services (ideally this should be centralized but keeping it here for refactoring simplicity)
const campaignRepo = new CampaignRepository(db);
const templateRepo = new EmailTemplateRepository(db);
const providerRepo = new EmailProviderRepository(db);
const projectRepo = new ProjectRepository(db);
const logRepo = new TriggeredSendLogRepository(db);
const contactRepo = new ContactRepository(db);
const workflowRepo = new WorkflowRepository(db);
const executionRepo = new WorkflowExecutionRepository(db);

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
  new SuppressionRepository(db),
  contactRepo,
  workflowRepo,
  automationService,
);

export const eventHandlers: Record<WorkflowEventType, EventHandler> = {
  contact_added: async (req, ctx) => {
    return await audienceService.createContact({
      projectId: ctx.projectId,
      email: req.email,
      name: req.name,
      locale: req.locale,
      meta: req.metadata,
    });
  },

  contact_updated: async (req, ctx) => {
    const contact = await contactRepo.findByEmail(ctx.projectId, req.email);
    if (!contact) throw new Error("Contact not found");

    const updated = await contactRepo.update(contact.id, {
      name: req.name,
      locale: req.locale,
      meta: { ...(contact.meta as any), ...req.metadata },
    });

    await automationService.triggerEvent({
      event: "contact_updated",
      projectId: ctx.projectId,
      contactId: contact.id,
      metadata: req.metadata,
    });

    return updated;
  },

  tag_added: async (req, ctx) => {
    const contact = await contactRepo.findByEmail(ctx.projectId, req.email);
    if (!contact) throw new Error("Contact not found");

    const currentTags = Array.isArray((contact.meta as any)?.tags)
      ? (contact.meta as any).tags
      : [];
    const newTags = Array.isArray(req.metadata?.tags) ? req.metadata?.tags : [];

    const combinedTags = Array.from(new Set([...currentTags, ...newTags]));

    const updated = await contactRepo.update(contact.id, {
      meta: { ...(contact.meta as any), tags: combinedTags },
    });

    await automationService.triggerEvent({
      event: "tag_added",
      projectId: ctx.projectId,
      contactId: contact.id,
      metadata: req.metadata,
    });

    return updated;
  },

  order_created: async (req, ctx) => {
    let contact = await contactRepo.findByEmail(ctx.projectId, req.email);
    if (!contact) {
      contact = await audienceService.createContact({
        projectId: ctx.projectId,
        email: req.email,
        name: req.name,
        locale: req.locale,
        meta: req.metadata,
      });
    }

    await automationService.triggerEvent({
      event: "order_created",
      projectId: ctx.projectId,
      contactId: contact.id,
      metadata: req.metadata,
    });

    return contact;
  },

  event_triggered: async (req, ctx) => {
    let contact = await contactRepo.findByEmail(ctx.projectId, req.email);
    if (!contact) {
      contact = await audienceService.createContact({
        projectId: ctx.projectId,
        email: req.email,
        name: req.name,
        locale: req.locale,
        meta: req.metadata,
      });
    }

    await automationService.triggerEvent({
      event: "event_triggered",
      projectId: ctx.projectId,
      contactId: contact.id,
      metadata: req.metadata,
    });

    return contact;
  },
};
