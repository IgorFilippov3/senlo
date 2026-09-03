import { generateApiKey } from "../api-key";
import { IApiKeyRepository, IProjectRepository } from "../ports";
import { ApiKey, Project } from "../domain";

export class SettingsService {
  constructor(
    private readonly apiKeyRepo: IApiKeyRepository,
    private readonly projectRepo: IProjectRepository,
  ) {}

  // API Keys
  async listApiKeys(projectId: number): Promise<ApiKey[]> {
    return await this.apiKeyRepo.findByProject(projectId);
  }

  async createApiKey(projectId: number, name: string): Promise<ApiKey> {
    return await this.apiKeyRepo.create({
      projectId,
      name,
      key: generateApiKey(),
    });
  }

  async deleteApiKey(id: number): Promise<void> {
    await this.apiKeyRepo.delete(id);
  }

  async getApiKeyById(id: number): Promise<ApiKey | null> {
    return await this.apiKeyRepo.findById(id);
  }

  // Workspace Settings
  async getWorkspace(id: number): Promise<Project | null> {
    return await this.projectRepo.findById(id);
  }

  async updateWorkspace(
    id: number,
    data: {
      name?: string;
      description?: string | null;
      providerId?: number | null;
      aiProviderId?: number | null;
    },
  ): Promise<Project | null> {
    return await this.projectRepo.update(id, data);
  }

  async deleteWorkspace(id: number): Promise<void> {
    await this.projectRepo.delete(id);
  }
}
