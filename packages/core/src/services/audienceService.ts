import { ISuppressionRepository } from "../ports";
import { Suppression } from "../domain";

export class AudienceService {
  constructor(private readonly suppressionRepo: ISuppressionRepository) {}

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
