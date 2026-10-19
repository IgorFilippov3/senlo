// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import type { AiProvider, AiProviderType } from "../../domain";
import { NotFoundError } from "../../errors";
import type { IAiProviderRepository } from "../../ports";
import { parseInput } from "../../validation";

export const AI_PROVIDER_TYPES = ["OPENAI", "ANTHROPIC"] as const satisfies readonly AiProviderType[];

/** The model used when the form leaves it empty. */
export const DEFAULT_AI_MODELS: Record<AiProviderType, string> = {
  OPENAI: "gpt-4o",
  ANTHROPIC: "claude-3-5-sonnet-20240620",
};

export const AiProviderInputSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  type: z.enum(AI_PROVIDER_TYPES),
  apiKey: z.string().min(1),
  model: z.string().trim().optional(),
});

export type AiProviderInput = z.infer<typeof AiProviderInputSchema>;
export type AiProviderFieldErrors = Partial<Record<keyof AiProviderInput | "general", string[]>>;

/** A user's AI providers (keys for design generation). */
export class AiProviderService {
  constructor(private readonly providers: IAiProviderRepository) {}

  listForUser(userId: string): Promise<AiProvider[]> {
    return this.providers.findByUser(userId);
  }

  /** The provider, if it is this user's; "not found" otherwise. */
  async requireOwned(userId: string, id: number): Promise<AiProvider> {
    const provider = await this.providers.findById(id);
    if (!userId || !provider || provider.userId !== userId) {
      throw new NotFoundError("AI provider");
    }
    return provider;
  }

  async create(userId: string, rawInput: unknown): Promise<AiProvider> {
    const input = parseInput(AiProviderInputSchema, rawInput);
    return this.providers.create({
      name: input.name,
      type: input.type,
      config: { apiKey: input.apiKey, model: input.model || DEFAULT_AI_MODELS[input.type] },
      isActive: true,
      userId,
    });
  }

  async setActive(userId: string, id: number, isActive: boolean): Promise<AiProvider> {
    await this.requireOwned(userId, id);
    const updated = await this.providers.update(id, { isActive });
    if (!updated) throw new NotFoundError("AI provider");
    return updated;
  }

  async delete(userId: string, id: number): Promise<void> {
    await this.requireOwned(userId, id);
    await this.providers.delete(id);
  }
}
