// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AccessGuard } from "../access";
import { ServiceHooks } from "../hooks";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "../api-key";
import type { ApiKey, IssuedApiKey } from "../domain";
import { NotFoundError, ValidationError } from "../errors";
import type { IApiKeyRepository, IProjectRepository } from "../ports";

export const API_KEY_NAME_MAX_LENGTH = 255;

/** A project's API keys. Every call checks the project is the user's. */
export class SettingsService {
  private readonly access: AccessGuard;

  constructor(
    private readonly apiKeys: IApiKeyRepository,
    projects: Pick<IProjectRepository, "findById">,
    access?: AccessGuard,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
  ) {
    this.access = access ?? new AccessGuard(projects);
  }

  async listApiKeys(userId: string, projectId: number): Promise<ApiKey[]> {
    await this.access.requireProject(userId, projectId, "read");
    return this.apiKeys.findByProject(projectId);
  }

  /** The returned `key` is shown once; only its hash and prefix are stored. */
  async createApiKey(userId: string, projectId: number, name: string): Promise<IssuedApiKey> {
    await this.access.requireProject(userId, projectId, "write");
    const trimmed = name?.trim() ?? "";
    if (!trimmed) throw new ValidationError("API key name is required");
    if (trimmed.length > API_KEY_NAME_MAX_LENGTH) {
      throw new ValidationError(`API key name too long (max ${API_KEY_NAME_MAX_LENGTH} characters)`);
    }
    const key = generateApiKey();
    const stored = await this.apiKeys.create({
      projectId,
      name: trimmed,
      keyHash: hashApiKey(key),
      prefix: apiKeyPrefix(key),
    });
    await this.hooks.audit({
      actor: { userId },
      action: "api_key.created",
      target: { type: "api_key", id: stored.id, projectId },
      details: { name: stored.name, prefix: stored.prefix },
    });
    return { ...stored, key };
  }

  /** Returns the key's project id, for the caller to revalidate. */
  async deleteApiKey(userId: string, id: number): Promise<{ projectId: number }> {
    const apiKey = await this.access.requireInProject(
      userId,
      await this.apiKeys.findById(id),
      "API key",
      "write",
    );
    await this.apiKeys.delete(id);
    await this.hooks.audit({
      actor: { userId },
      action: "api_key.deleted",
      target: { type: "api_key", id, projectId: apiKey.projectId },
      details: { name: apiKey.name, prefix: apiKey.prefix },
    });
    return { projectId: apiKey.projectId };
  }
}
