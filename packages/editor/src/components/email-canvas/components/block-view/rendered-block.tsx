"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  getBlockDefinition,
  replaceMergeTags,
  resolveGlobals,
  type ContentBlock,
  type GlobalSettings,
  type RenderContext,
} from "@senlo/core";

/**
 * Neutral ground for the email markup.
 *
 * `all: initial` gives the block the same starting point a mail client would:
 * none of the application's typography, resets or Tailwind preflight reach it.
 * That is the whole point of the shadow root - the block has to be styled by
 * the same inline styles that will style it in the recipient's inbox, and by
 * nothing else.
 */
const SHADOW_RESET = `
  :host { all: initial; display: block; }
  * { box-sizing: content-box; }
  img { max-width: 100%; }
  a { cursor: pointer; }
`;

/** An image block with no source yet. A broken-image icon helps nobody. */
const EMPTY_IMAGE = `
  <div style="border: 1px dashed #cbd5e1; border-radius: 6px; padding: 28px 16px; text-align: center; color: #64748b; font: 14px/1.4 system-ui, sans-serif;">
    Image — choose a file or paste a URL
  </div>
`;

export interface RenderedBlockProps {
  block: ContentBlock;
  settings?: GlobalSettings;
  previewMode: boolean;
  previewData?: Record<string, any>;
  localData?: Record<string, any>;
}

/**
 * Shows a block exactly as the renderer will send it.
 *
 * The canvas used to draw every block a second time in React - 550 lines of
 * JSX whose defaults, units and layout drifted from the renderer's, which is
 * where "it looked right in the editor" came from. There is one implementation
 * now; this component only decides where it goes.
 */
export const RenderedBlock = ({
  block,
  settings,
  previewMode,
  previewData,
  localData,
}: RenderedBlockProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const html = useMemo(() => {
    const definition = getBlockDefinition(block.type);
    if (!definition) {
      return `<div style="font: 12px system-ui, sans-serif; color: #b91c1c;">Unsupported block type: ${String(
        (block as any).type,
      ).replace(/[^a-z0-9_-]/gi, "")}</div>`;
    }

    if (block.type === "image" && !(block as any).data?.src) {
      return EMPTY_IMAGE;
    }

    const context: RenderContext = {
      responsiveStyles: [],
      localData,
      globals: resolveGlobals(settings),
      options: previewData ? { data: previewData } : undefined,
    };

    const rendered = definition.renderHTML(block, context);

    // Merge tags are substituted over the whole document when a message is
    // sent. Here there is no document, so the same substitution runs per block.
    return previewMode && previewData
      ? replaceMergeTags(rendered, previewData, localData)
      : rendered;
  }, [block, settings, previewMode, previewData, localData]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${SHADOW_RESET}</style>${html}`;
  }, [html]);

  return <div ref={hostRef} />;
};
