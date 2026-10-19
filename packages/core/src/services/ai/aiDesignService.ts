// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard } from "../../access";
import { emailDesignDocumentSchema, type EmailDesignDocumentDTO } from "../../emailDesign";
import { AppError, NotFoundError, ValidationError } from "../../errors";
import type { IAiProviderRepository, IProjectRepository } from "../../ports";
import { parseInput } from "../../validation";
import { openAiCompletionClient, type ChatMessage, type JsonCompletionClient } from "./completion";

export const AiGenerateRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required"),
  projectId: z.coerce.number().int().positive(),
  currentDesign: z.unknown().optional(),
});

export type AiGenerateRequest = z.infer<typeof AiGenerateRequestSchema>;

export const DESIGN_SYSTEM_PROMPT = `
You are an expert email designer for the Senlo Email Builder.
... (rest of the prompt)
`;

export function editModePrompt(currentDesign: unknown): string {
  return `You are in EDIT mode. The user wants to modify their existing email design.

Current design JSON:
${JSON.stringify(currentDesign)}

Instructions for EDIT mode:
1. Respect the existing structure where possible unless the user explicitly asks to change it.
2. You can add new rows, remove rows, or update existing rows/blocks.
3. Keep the same JSON format as specified in the general rules.
4. If the user asks for a small change, don't rewrite everything from scratch if not needed, but return the COMPLETE design JSON reflecting the changes.`;
}

function hasRows(design: unknown): boolean {
  return (
    typeof design === "object" &&
    design !== null &&
    Array.isArray((design as { rows?: unknown }).rows) &&
    (design as { rows: unknown[] }).rows.length > 0
  );
}

/**
 * Generates or edits an email design from a prompt with the project's AI
 * provider. Resolves and checks the provider, builds the messages, and
 * refuses a model answer that is not a valid design document.
 */
export class AiDesignService {
  private readonly access: AccessGuard;
  private readonly clients: ReadonlyMap<string, JsonCompletionClient>;

  constructor(
    projects: Pick<IProjectRepository, "findById">,
    private readonly aiProviders: Pick<IAiProviderRepository, "findById">,
    clients: JsonCompletionClient[] = [openAiCompletionClient],
  ) {
    this.access = new AccessGuard(projects);
    this.clients = new Map(clients.map((c) => [c.type, c]));
  }

  /** `rawRequest` is the request body as received. */
  async generate(userId: string, rawRequest: unknown): Promise<EmailDesignDocumentDTO> {
    const request = parseInput(AiGenerateRequestSchema, rawRequest);
    const project = await this.access.requireProject(userId, request.projectId);

    if (!project.aiProviderId) {
      throw new ValidationError("No AI provider configured for this project");
    }
    const provider = await this.aiProviders.findById(project.aiProviderId);
    if (!provider) {
      throw new NotFoundError("AI provider");
    }
    const client = this.clients.get(provider.type);
    if (!client) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Provider type ${provider.type} is not yet supported`,
        undefined,
        501,
      );
    }

    const messages: ChatMessage[] = [{ role: "system", content: DESIGN_SYSTEM_PROMPT }];
    if (hasRows(request.currentDesign)) {
      messages.push({ role: "system", content: editModePrompt(request.currentDesign) });
    }
    messages.push({ role: "user", content: request.prompt });

    const content = await client.completeJson({
      apiKey: String(provider.config.apiKey ?? ""),
      model: String(provider.config.model || "gpt-4o"),
      messages,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "AI returned something other than JSON", undefined, 422);
    }
    const design = emailDesignDocumentSchema.safeParse(parsed);
    if (!design.success) {
      throw new AppError(
        "EXTERNAL_SERVICE_ERROR",
        "AI generated an invalid template structure",
        { details: design.error.errors },
        422,
      );
    }
    return design.data;
  }
}
