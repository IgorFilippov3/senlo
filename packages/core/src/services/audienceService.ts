import { AccessGuard } from "../access";
import { ServiceHooks } from "../hooks";
import {
  ISuppressionRepository,
  ContactRepository,
  IProjectRepository,
  IWorkflowRepository,
} from "../ports";
import { Suppression, Contact } from "../domain";
import { AutomationService } from "./automationService";

export class AudienceService {
  private readonly access: AccessGuard;

  constructor(
    private readonly suppressionRepo: ISuppressionRepository,
    private readonly contactRepo: ContactRepository,
    private readonly workflowRepo: IWorkflowRepository,
    private readonly automationService: AutomationService,
    projects: Pick<IProjectRepository, "findById">,
    access?: AccessGuard,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
  ) {
    this.access = access ?? new AccessGuard(projects);
  }

  async createContact(data: {
    projectId: number;
    email: string;
    name?: string | null;
    locale?: string | null;
    meta?: Record<string, any> | null;
  }): Promise<Contact> {
    // An upsert of a known address is an update, not a new contact: only a
    // new one is checked against a plan and counted.
    const isNew = !(await this.contactRepo.findByEmail(data.projectId, data.email));
    if (isNew) await this.hooks.requireQuota({ type: "contact.create", projectId: data.projectId });

    const contact = await this.contactRepo.upsert(data);
    if (isNew) {
      await this.hooks.recordUsage({ type: "contact.created", projectId: data.projectId, contactId: contact.id });
    }

    // Trigger workflows for 'contact_added' event
    await this.automationService.triggerEvent({
      event: "contact_added",
      projectId: data.projectId,
      contactId: contact.id,
      metadata: contact.meta as Record<string, any>,
    });

    return contact;
  }

  async listProjectSuppressions(userId: string, projectId: number): Promise<Suppression[]> {
    await this.access.requireProject(userId, projectId, "read");
    return await this.suppressionRepo.findByProject(projectId);
  }

  /** Returns the entry's project id, for the caller to revalidate. */
  async removeSuppression(userId: string, id: number): Promise<{ projectId: number }> {
    const suppression = await this.access.requireInProject(
      userId,
      await this.suppressionRepo.findById(id),
      "Suppression",
      "write",
    );
    await this.suppressionRepo.delete(id);
    return { projectId: suppression.projectId };
  }
}
