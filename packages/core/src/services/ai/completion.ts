// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AiProviderType } from "../../domain";
import { AppError } from "../../errors";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * The one call design generation needs from a model: messages in, a JSON
 * document out. One implementation per provider type.
 */
export interface JsonCompletionClient {
  readonly type: AiProviderType;
  completeJson(options: {
    apiKey: string;
    model: string;
    messages: ChatMessage[];
  }): Promise<string>;
}

/** OpenAI chat completions in JSON mode, over fetch. */
export const openAiCompletionClient: JsonCompletionClient = {
  type: "OPENAI",

  async completeJson({ apiKey, model, messages }) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        if (body.error?.message) detail = body.error.message;
      } catch {
        // No JSON body; keep the status line.
      }
      throw new AppError("EXTERNAL_SERVICE_ERROR", `OpenAI request failed: ${detail}`);
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "No content received from OpenAI");
    }
    return content;
  },
};
