// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AccessGuard } from "../access";
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
  ) {
    this.access = access ?? new AccessGuard(projects);
  }

  async listApiKeys(userId: string, projectId: number): Promise<ApiKey[]> {
    await this.access.requireProject(userId, projectId);
    return this.apiKeys.findByProject(projectId);
  }

  /** The returned `key` is shown once; only its hash and prefix are stored. */
  async createApiKey(userId: string, projectId: number, name: string): Promise<IssuedApiKey> {
    await this.access.requireProject(userId, projectId);
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
    return { ...stored, key };
  }

  /** Returns the key's project id, for the caller to revalidate. */
  async deleteApiKey(userId: string, id: number): Promise<{ projectId: number }> {
    const apiKey = await this.access.requireInProject(
      userId,
      await this.apiKeys.findById(id),
      "API key",
    );
    await this.apiKeys.delete(id);
    return { projectId: apiKey.projectId };
  }
}
