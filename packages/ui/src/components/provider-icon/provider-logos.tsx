import type React from "react";

/**
 * A provider's own mark, by provider type (`RESEND`, `SES`, ...).
 *
 * Empty on purpose: these are other companies' trademarks, so each one comes
 * from that company's brand page, under its terms, and is added here by hand
 * as a component that returns the official SVG (with `fill="currentColor"`
 * if the brand allows a single colour). A type without an entry shows its
 * monogram instead; nothing else has to change.
 */
export const PROVIDER_LOGOS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {};
