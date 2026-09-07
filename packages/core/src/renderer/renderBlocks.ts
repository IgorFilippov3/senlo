import type { ContentBlock } from "../emailDesign";
import { RenderContext } from "./types";
import { evaluateCondition } from "./conditions";
import { getBlockDefinition } from "../blocks/registry";

/**
 * Renders one block to the HTML that is sent. The per-type markup lives in the
 * block's own definition (`src/blocks/<type>.ts`); this is only the lookup and
 * the condition check that applies to every block equally.
 */
export function renderBlock(
  block: ContentBlock,
  context: RenderContext,
): string {
  if (!evaluateCondition(block.condition, context)) {
    return "";
  }

  const definition = getBlockDefinition(block.type);
  if (!definition) {
    return `<!-- Unknown block type: ${String((block as any).type).replace(/[^a-z0-9_-]/gi, "")} -->`;
  }

  return definition.renderHTML(block, context);
}
