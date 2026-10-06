// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ColumnSettings } from "../emailDesign";
import {
  borderDeclarations,
  formatCornerRadius,
  hasCornerRadius,
  hasMargin,
  renderPadding,
  resolveCornerRadius,
} from "./utils";

export interface ColumnCard {
  /** The gap outside the card. */
  outer: Record<string, string>;
  /** The card itself: background, border, corners and the space inside. */
  card: Record<string, string>;
}

const camel = (name: string) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/**
 * The column's card as style objects, for the canvas.
 *
 * Built from the same helpers `renderColumnBox` writes the message with, so the
 * editor cannot draw a border or a corner the recipient will not get.
 */
export function columnCard(settings?: ColumnSettings): ColumnCard {
  const outer: Record<string, string> = {};
  const card: Record<string, string> = {};

  if (hasMargin(settings?.margin)) outer.padding = renderPadding(settings!.margin);

  if (!settings) return { outer, card };

  if (settings.backgroundColor) card.backgroundColor = settings.backgroundColor;

  for (const declaration of borderDeclarations(settings.border)) {
    const [name, value] = declaration.split(/:\s*/, 2);
    card[camel(name)] = value;
  }

  if (hasCornerRadius(settings.borderRadius))
    card.borderRadius = formatCornerRadius(resolveCornerRadius(settings.borderRadius));

  if (hasMargin(settings.padding)) card.padding = renderPadding(settings.padding);

  return { outer, card };
}
