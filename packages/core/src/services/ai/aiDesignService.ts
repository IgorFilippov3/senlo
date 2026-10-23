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

/**
 * What the model is told about the design document. Kept in step with
 * `emailDesign.ts` and `blocks/*` by hand: every block type, required field
 * and enum named here is checked by `emailDesignDocumentSchema` on the way
 * back, so an answer that drifts from this description is refused, not sent.
 */
export const DESIGN_SYSTEM_PROMPT = `You are an expert email designer working inside Senlo, a transactional and campaign email builder. You turn a request into a complete email design document.

# Output

Answer with ONE JSON object and nothing else: no markdown fences, no comments, no prose before or after. The object must match this shape exactly:

{
  "version": 4,
  "settings": { "backgroundColor": "#f4f4f5", "contentWidth": 600, "fontFamily": "Arial, Helvetica, sans-serif", "textColor": "#111827" },
  "rows": [ Row, ... ]
}

Row:
{
  "id": "row-1",
  "type": "row",
  "settings": { "backgroundColor": "#ffffff", "padding": { "top": 24, "right": 24, "bottom": 24, "left": 24 } },
  "columns": [ Column, ... ]
}
Optional row settings: "fullWidth" (boolean, background spans the whole viewport), "align" ("left" | "center"), "margin" (padding object), "borderRadius" ({ "top", "bottom" }), "width" (px, at most contentWidth), "stackOnMobile" (boolean, default true).

Column:
{ "id": "col-1", "width": 100, "blocks": [ Block, ... ] }
Column widths are percentages and the columns of a row add up to 100 (100; 50/50; 33/34/33; 30/70). Optional "settings": { "backgroundColor", "border": { "width", "style", "color" }, "borderRadius", "padding", "margin" } makes a column a card.

Every row, column and block has a unique string "id". Pixel sizes are integers. Colors are hex strings. A padding or margin object is { "top", "right", "bottom", "left" } in px; all four keys optional.

# Blocks

Each block is { "id", "type", "data": { ... } }. "type" is one of the following, with these "data" fields (required fields marked *):

- "heading": text*, level (1-6), align ("left" | "center" | "right"), color, fontSize, lineHeight, fontWeight ("normal" | "bold"), textTransform ("none" | "uppercase"), letterSpacing, href, padding
- "paragraph": text*, align, color, fontSize, lineHeight, fontWeight, textTransform, letterSpacing, href, padding. Plain text only, no HTML tags.
- "image": src* (absolute https URL), alt, href, width (px), align, borderRadius, padding, border, fullWidth (boolean)
- "button": text*, href*, align, color (text), backgroundColor, fontSize, fontWeight, borderRadius, padding (inside the button), margin (around it), border, fullWidth (boolean), textTransform, letterSpacing
- "spacer": height* (px)
- "divider": color, width (percent), align, borderWidth, borderStyle ("solid" | "dashed" | "dotted"), padding
- "list": items* (array of plain strings, at least one), listType ("ordered" | "unordered"), align, color, fontSize, lineHeight, fontWeight, padding
- "product-line": items* (array of { "left", "right" } strings: label and value, e.g. an order summary), leftStyle / rightStyle ({ color, fontSize, lineHeight, fontWeight }), rightWidth (px), leftAlign, rightAlign, rowPadding, divider ({ width, style, color }), padding
- "socials": links* (array of { "type", "url", "icon" }; type is one of "facebook" | "twitter" | "instagram" | "youtube" | "discord" | "github" | "reddit"; icon is an absolute https URL of the icon image), align, size (px), spacing (px), padding
- "table": columns* (array of { "key", "label", "width" (percent), "align" }), rows (array of string arrays, one per table row, positional to the columns) or source (a merge-tag path to an array in the data), showHeader, headerBackgroundColor, headerStyle, textStyle, cellPadding, padding
- "progress": steps* (array of { "label", "value" }), statusVariable (merge-tag path whose value selects the step), completedColor, activeColor, pendingColor, barHeight, barRadius, gap, showLabels, padding

Blocks heading, paragraph, list, product-line, socials, table and progress also accept card styling: backgroundColor, border ({ width, style, color }), borderRadius, margin.

Any block, and any row, may carry "condition": { "variable": "<merge-tag path>", "operator": "equals" | "not_equals" | "gt" | "lt" | "is_set" | "is_not_set", "value": <string | number | boolean> } and is then rendered only when it holds. A row may carry "loop": { "variable": "<path to an array>", "alias": "item" } and is then repeated once per element, with the element available as the alias.

# Merge tags

Text, URLs and conditions may use merge tags in double braces, substituted per recipient: {{contact.name}}, {{contact.email}}, {{contact.meta.<field>}} for stored contact fields, {{custom.<field>}} for variables passed with a triggered send, {{project.name}}, and the alias of an enclosing loop such as {{item.title}}. Use {{unsubscribeUrl}} as the href of an unsubscribe link in campaign footers. Do not invent tags beyond these; when a value is not known, write a sensible placeholder in plain text instead.

# Design rules

- Build real content for the request: concrete headings, copy, button labels and link targets, not lorem ipsum. Ask yourself what the recipient needs to read first and put it first.
- Keep the structure simple: a single 600px column for most of the message; two or three columns only for feature grids, side-by-side cards or a thumbnail beside text.
- Use rows with their own backgrounds and padding to separate header, body and footer. Use spacers for vertical rhythm rather than empty paragraphs.
- Pick one accent color for buttons and headings and use it consistently; keep body text dark on a light background, with fontSize 14-16 and lineHeight 1.4-1.6 for paragraphs.
- Images need a real https "src". When no image URL is known, leave the image out rather than inventing a URL.
- Always end with a footer row: sender name, a short plain-text reason the recipient gets this email, and, for marketing content, an unsubscribe link using {{unsubscribeUrl}}.
- Use only the block types and fields listed above. Omit a field rather than setting it to null.`;

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
    access?: AccessGuard,
  ) {
    this.access = access ?? new AccessGuard(projects);
    this.clients = new Map(clients.map((c) => [c.type, c]));
  }

  /** `rawRequest` is the request body as received. */
  async generate(userId: string, rawRequest: unknown): Promise<EmailDesignDocumentDTO> {
    const request = parseInput(AiGenerateRequestSchema, rawRequest);
    // Generation returns a design and stores nothing: reading the project is enough.
    const project = await this.access.requireProject(userId, request.projectId, "read");

    if (!project.aiProviderId) {
      throw new ValidationError("No AI provider configured for this project");
    }
    const provider = await this.aiProviders.findById(project.aiProviderId);
    if (!provider) {
      throw new NotFoundError("AI provider");
    }
    if (provider.configUnreadable) {
      throw new ValidationError(
        "The AI provider's API key cannot be decrypted. Delete the provider and add it again.",
      );
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
