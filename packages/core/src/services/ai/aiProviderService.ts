// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { DEFAULT_AI_MODELS, type AiProvider, type AiProviderType, type PublicAiProvider } from "../../domain";
import { NotFoundError } from "../../errors";
import type { IAiProviderRepository } from "../../ports";
import { parseInput } from "../../validation";

export const AI_PROVIDER_TYPES = ["OPENAI", "ANTHROPIC"] as const satisfies readonly AiProviderType[];

// Lives in the domain so forms can show it; re-exported for existing imports.
export { DEFAULT_AI_MODELS } from "../../domain";

export const AiProviderInputSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  type: z.enum(AI_PROVIDER_TYPES),
  apiKey: z.string().min(1),
  model: z.string().trim().optional(),
});

export type AiProviderInput = z.infer<typeof AiProviderInputSchema>;
export type AiProviderFieldErrors = Partial<Record<keyof AiProviderInput | "general", string[]>>;

/** The provider without its API key, for anything a browser receives. */
export function toPublicAiProvider(provider: AiProvider): PublicAiProvider {
  const { apiKey, model } = provider.config ?? {};
  return {
    ...provider,
    config: typeof model === "string" ? { model } : {},
    secretsSet: apiKey ? ["apiKey"] : [],
  };
}

/**
 * A user's AI providers (keys for design generation). The UI gets the public
 * view; only `requireOwned` returns the key, for server-side use.
 */
export class AiProviderService {
  constructor(private readonly providers: IAiProviderRepository) {}

  async listForUser(userId: string): Promise<PublicAiProvider[]> {
    return (await this.providers.listForUser(userId)).map(toPublicAiProvider);
  }

  /** The provider, if it is this user's; "not found" otherwise. */
  async requireOwned(userId: string, id: number): Promise<AiProvider> {
    const provider = await this.providers.findById(id);
    if (!userId || !provider || provider.userId !== userId) {
      throw new NotFoundError("AI provider");
    }
    return provider;
  }

  async create(userId: string, rawInput: unknown): Promise<PublicAiProvider> {
    const input = parseInput(AiProviderInputSchema, rawInput);
    const created = await this.providers.create({
      name: input.name,
      type: input.type,
      config: { apiKey: input.apiKey, model: input.model || DEFAULT_AI_MODELS[input.type] },
      isActive: true,
      userId,
    });
    return toPublicAiProvider(created);
  }

  async setActive(userId: string, id: number, isActive: boolean): Promise<PublicAiProvider> {
    await this.requireOwned(userId, id);
    const updated = await this.providers.update(id, { isActive });
    if (!updated) throw new NotFoundError("AI provider");
    return toPublicAiProvider(updated);
  }

  async delete(userId: string, id: number): Promise<void> {
    await this.requireOwned(userId, id);
    await this.providers.delete(id);
  }
}
