// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cssColorSchema } from "../blocks/shared";
import type { LinearGradient } from "../blocks/shared";
import type { RowBlock } from "../emailDesign";
import type { RenderContext } from "./types";

/**
 * @fileoverview What paints behind a row, decided once.
 *
 * The canvas draws a row's chrome itself - `row-view.tsx` builds its own
 * `bandStyle` and `contentStyle` in React, because a row, unlike a block, does
 * not go through the renderer to reach the editor. That has already produced
 * one visible bug (a row shown inset by 16px and sent flush to the edge), and a
 * background that exists in two shapes at once would be the next. Both sides
 * call this instead.
 */

export interface RowBackground {
  /** Always present. What every client shows, and all that most of them show. */
  backgroundColor: string;
  /** Only when the row has a gradient, and only for clients that honour it. */
  backgroundImage?: string;
}

/** CSS degrees. 180 runs top to bottom, which is what a hero band almost always wants. */
const DEFAULT_ANGLE = 180;

/** A colour the schema would have accepted. Anything else is dropped rather than written out. */
function safeColor(value: unknown): string | null {
  const parsed = cssColorSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The gradient as CSS, or null if it is not one this renderer will write.
 *
 * Assembled from validated parts rather than escaped as a unit: `escapeCssValue`
 * strips parentheses, so a finished `linear-gradient(...)` would come out of it
 * mangled. A document can reach here from the AI endpoint or the public API
 * without the editor's form ever having seen it, so the check belongs here and
 * not only in the panel.
 */
export function linearGradientCss(gradient?: LinearGradient): string | null {
  if (!gradient) return null;

  const from = safeColor(gradient.from);
  const to = safeColor(gradient.to);
  if (!from || !to) return null;

  // Only an actual number counts as an angle. Coercing instead would turn
  // `null` into 0 - a real, in-range value - and render the gradient upside
  // down for a document whose angle was null rather than absent, which is the
  // shape a payload that never went through the form can easily have.
  const raw = gradient.angle;
  const angle =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 360
      ? Math.round(raw)
      : DEFAULT_ANGLE;

  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

/**
 * The colour and, when there is one, the image that paint behind a row.
 *
 * The colour is passed through exactly as the row stores it. It has always been
 * written into the style attribute unvalidated, and tightening that here would
 * change how documents already in the database render - a separate decision,
 * and not one to make as a side effect of adding a gradient. Only the gradient,
 * which is new and has nothing stored behind it, goes through the schema.
 *
 * A row with a gradient but no colour of its own takes the gradient's first
 * stop as its colour. `transparent` there would show the document's background
 * through a row the author deliberately painted, in every client that does not
 * do gradients - which is not a fallback, it is the absence of one.
 */
export function rowBackground(settings?: RowBlock["settings"]): RowBackground {
  const image = linearGradientCss(settings?.backgroundGradient);
  const declared = settings?.backgroundColor;

  // The no-gradient path is byte for byte what it was before this module
  // existed, which is what every stored template depends on.
  if (!image) return { backgroundColor: declared || "transparent" };

  if (declared && declared !== "transparent") {
    return { backgroundColor: declared, backgroundImage: image };
  }

  const from = safeColor(settings?.backgroundGradient?.from);
  return { backgroundColor: from ?? "transparent", backgroundImage: image };
}

/**
 * The same thing as CSS declarations, in the order a mail client has to read
 * them: colour first, so a client that drops the image keeps the colour.
 */
export function rowBackgroundDeclarations(
  settings?: RowBlock["settings"],
): string[] {
  const { backgroundColor, backgroundImage } = rowBackground(settings);

  const declarations = [`background-color: ${backgroundColor}`];
  if (backgroundImage) declarations.push(`background-image: ${backgroundImage}`);

  return declarations;
}

/** djb2, base36. Short, stable, and it needs no state carried between rows. */
function hash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * Puts a row's gradient in the document's stylesheet and returns the class that
 * reads it.
 *
 * Gmail on Android is the reason this exists. It supports `linear-gradient()`
 * but not inline: it rewrites the declaration in the style attribute into
 * something that does not paint, and honours the same declaration from a
 * `<style>` block. So the gradient is written twice - inline for every other
 * client, and here for that one - and the rule carries `!important` because the
 * broken inline declaration would otherwise win on specificity in exactly the
 * client this is for.
 *
 * The class is named after the gradient rather than the row, so two rows with
 * the same gradient share one rule and the names do not depend on the order
 * rows happen to render in. Row ids cannot be used: they are arbitrary strings
 * and would have to be sanitised into a selector.
 *
 * Nothing needs escaping. The value was assembled in `linearGradientCss` from
 * schema-checked colours and a bounded integer, so it cannot carry `<`, `}` or
 * `;` - which is the property `renderHead` depends on when it drops the rule
 * into the stylesheet.
 */
export function registerRowBackground(
  context: RenderContext,
  backgroundImage: string,
): string {
  const className = `senlo-bg-${hash(backgroundImage)}`;
  const rule = `.${className} { background-image: ${backgroundImage} !important; }`;

  if (!context.responsiveStyles.includes(rule)) {
    context.responsiveStyles.push(rule);
  }

  return className;
}
