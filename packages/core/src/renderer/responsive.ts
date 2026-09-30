// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RenderContext } from "./types";

/**
 * @fileoverview Rules that have to live in the document's stylesheet.
 *
 * Most of what this renderer emits is inline, because that is what survives the
 * widest set of clients. Two things cannot be: a media query, which has no
 * inline form at all, and a gradient, which Gmail on Android rewrites inline and
 * reads only from a `<style>` block.
 *
 * `renderHead` interpolates `context.responsiveStyles` when it is called, which
 * is why `renderEmailDesign` renders the body first - a rule collected here
 * during the body reaches the stylesheet, and would not the other way round.
 */

/** djb2, base36. Short, stable, and it needs no state carried between blocks. */
function hash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * Puts one rule in the document's stylesheet and returns the class that reads
 * it.
 *
 * The class is named after the rule rather than after the element that wanted
 * it, so two blocks asking for the same thing share one rule and the names do
 * not depend on the order things render in. Ids cannot be used: they are
 * arbitrary strings and would have to be sanitised into a selector.
 *
 * `body` and `media` are assembled by the caller from checked parts - a colour
 * that passed a schema, a bounded number - because nothing here escapes them,
 * and a `}` in either would end the rule early.
 */
export interface StyleRuleOptions {
  /** Wraps the rule in a media query, for anything that is not unconditional. */
  media?: string;
  /**
   * A descendant selector appended to the class, for a rule that has to reach
   * the elements inside rather than the element itself.
   *
   * A table's type size is the case this exists for: put `font-size` on the
   * table and every cell ignores it, because each cell carries its own inline
   * `font-size`, and an inline declaration beats an inherited one however
   * important the ancestor's is.
   */
  within?: string;
}

export function registerStyleRule(
  context: RenderContext,
  prefix: string,
  body: string,
  options: StyleRuleOptions = {},
): string {
  const { media, within } = options;
  const className = `senlo-${prefix}-${hash(`${media ?? ""}|${within ?? ""}|${body}`)}`;

  const selector = within ? `.${className} ${within}` : `.${className}`;
  const declaration = `${selector} { ${body} }`;
  const rule = media ? `@media ${media} { ${declaration} }` : declaration;

  if (!context.responsiveStyles.includes(rule)) {
    context.responsiveStyles.push(rule);
  }

  return className;
}
