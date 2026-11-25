import { hashApiKey } from "../api-key";
import { principalFromApiKey, type ApiPrincipal } from "../api-principal";
import type { ApiMe } from "../api-v1/schemas";
import { NotFoundError } from "../errors";
import { IApiKeyRepository, IProjectRepository } from "../ports";
import { ApiKey } from "../domain";

export class AuthService {
  constructor(
    private readonly apiKeyRepo: IApiKeyRepository,
    private readonly projects: Pick<IProjectRepository, "findById">,
  ) {}

  /**
   * The principal behind a bearer token, or null when the token is no key.
   * `client` is the request's `Senlo-Client` label (`clientLabel`). OAuth
   * tokens will be resolved here too, so routes never look at the token.
   */
  async resolvePrincipal(token: string, client: string | null): Promise<ApiPrincipal | null> {
    const apiKey = await this.validateApiKey(token);
    return apiKey ? principalFromApiKey(apiKey, client) : null;
  }

  /** What `GET /api/v1/me` shows, except the instance, which only the host knows. */
  async describePrincipal(principal: ApiPrincipal): Promise<Omit<ApiMe, "instance">> {
    const project = await this.projects.findById(principal.projectId);
    if (!project) throw new NotFoundError("Project", principal.projectId);

    const apiKey = "apiKeyId" in principal.actor ? await this.apiKeyRepo.findById(principal.actor.apiKeyId) : null;

    return {
      project: { id: project.id, name: project.name },
      permissions: [...principal.permissions],
      auth: {
        source: principal.source,
        apiKey: apiKey ? { id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix } : null,
        client: principal.client,
      },
    };
  }

  /**
   * Validates an API key and updates its last used timestamp.
   * @param key The API key string
   * @returns The API key if valid, null otherwise
   */
  async validateApiKey(key: string): Promise<ApiKey | null> {
    // Hashed rows first; a row written before hashing is matched in the clear
    // until `db:hash-api-keys` has moved it.
    const apiKey =
      (await this.apiKeyRepo.findByHash(hashApiKey(key))) ??
      (await this.apiKeyRepo.findLegacyByKey(key));

    if (!apiKey) {
      return null;
    }

    // Update last used asynchronously (fire and forget in background)
    void this.apiKeyRepo.updateLastUsed(apiKey.id);

    return apiKey;
  }
}
