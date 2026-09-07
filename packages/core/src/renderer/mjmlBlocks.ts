import type { ContentBlock } from "../emailDesign";
import { RenderOptions } from "./types";
import { replaceMergeTags } from "../merge-tags";
import { evaluateCondition } from "./conditions";
import { getBlockDefinition } from "../blocks/registry";

export function renderMJMLBlock(
  block: ContentBlock,
  options?: RenderOptions,
  localData?: Record<string, any>,
): string {
  // The HTML path drops a block whose condition is false; without the same
  // check here the exported MJML shows blocks the recipient never sees.
  const visible = evaluateCondition(block.condition, {
    responsiveStyles: [],
    options,
    localData,
  });
  if (!visible) return "";

  const definition = getBlockDefinition(block.type);
  const content = definition
    ? definition.renderMJML(block, options)
    : `<!-- Unknown MJML block type: ${String((block as any).type).replace(/[^a-z0-9_-]/gi, "")} -->`;

  if (localData && options?.data) {
    return replaceMergeTags(content, options.data, localData);
  }

  return content;
}
