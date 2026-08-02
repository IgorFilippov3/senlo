import { IApiKeyRepository } from "../ports";
import { ApiKey } from "../domain";

export class AuthService {
  constructor(private readonly apiKeyRepo: IApiKeyRepository) {}

  /**
   * Validates an API key and updates its last used timestamp.
   * @param key The API key string
   * @returns The API key if valid, null otherwise
   */
  async validateApiKey(key: string): Promise<ApiKey | null> {
    const apiKey = await this.apiKeyRepo.findByKey(key);

    if (!apiKey) {
      return null;
    }

    // Update last used asynchronously (fire and forget in background)
    void this.apiKeyRepo.updateLastUsed(apiKey.id);

    return apiKey;
  }
}
