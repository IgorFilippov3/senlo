import type { EmailTemplate } from "../emailTemplate";
import type { IEmailTemplateRepository } from "../ports";

export class TemplateService {
  constructor(private readonly templates: IEmailTemplateRepository) {}

  async createTemplate(input: {
    projectId: number;
    name: string;
    subject: string;
    html: string;
    designJson?: unknown;
  }): Promise<EmailTemplate> {
    return this.templates.create(input);
  }

  async listProjectTemplates(projectId: number): Promise<EmailTemplate[]> {
    return this.templates.findByProject(projectId);
  }
}
