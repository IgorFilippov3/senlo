// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Chart colours, as hex: an SVG attribute cannot read a CSS variable, so
 * these repeat @senlo/ui's tokens by value. A test in @senlo/next keeps the
 * two in step.
 */
export const CHART_COLORS = {
  /** The main series: the accent, the one place it is used as data ink. */
  primary: "#a9441f",
  /** The second series: graphite. */
  secondary: "#1c1b19",
  /** A series that is a warning (suppressed sends). */
  warning: "#a8730a",
  grid: "#f1ece3",
  tick: "#6b655b",
} as const;
