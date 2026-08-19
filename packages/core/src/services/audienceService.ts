import {
  ISuppressionRepository,
  ContactRepository,
  IWorkflowRepository,
} from "../ports";
import { Suppression, Contact } from "../domain";
import { AutomationService } from "./automationService";

export class AudienceService {
  constructor(
    private readonly suppressionRepo: ISuppressionRepository,
    private readonly contactRepo: ContactRepository,
    private readonly workflowRepo: IWorkflowRepository,
    private readonly automationService: AutomationService,
  ) {}

  async createContact(data: {
    projectId: number;
    email: string;
    name?: string | null;
    locale?: string | null;
    meta?: Record<string, any> | null;
  }): Promise<Contact> {
    const contact = await this.contactRepo.upsert(data);

    // Trigger workflows for 'contact_added' event
    const workflows = await this.workflowRepo.findByProject(data.projectId);
    for (const workflow of workflows) {
      if (workflow.status === "ACTIVE") {
        const nodes = await this.workflowRepo.getNodes(workflow.id);
        const hasTrigger = nodes.some(
          (n) => n.type === "trigger" && n.data.event === "contact_added",
        );

        if (hasTrigger) {
          await this.automationService.triggerWorkflow({
            workflowId: workflow.id,
            contactId: contact.id,
            projectId: data.projectId,
          });
        }
      }
    }

    return contact;
  }

  async listAllSuppressions(
    userId: string,
  ): Promise<(Suppression & { projectName: string })[]> {
    return await this.suppressionRepo.findAllByUser(userId);
  }

  async listProjectSuppressions(projectId: number): Promise<Suppression[]> {
    return await this.suppressionRepo.findByProject(projectId);
  }

  async removeSuppression(id: number): Promise<void> {
    await this.suppressionRepo.delete(id);
  }

  async getSuppressionById(id: number): Promise<Suppression | null> {
    return await this.suppressionRepo.findById(id);
  }
}
