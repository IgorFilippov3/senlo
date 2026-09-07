import { fallbacksFor } from "./common";

const fallbacks = fallbacksFor("socials");

export const DEFAULT_SOCIALS_ALIGN = fallbacks.align;
export const DEFAULT_SOCIALS_SIZE = fallbacks.size;
export const DEFAULT_SOCIALS_SPACING = fallbacks.spacing;
export const DEFAULT_SOCIALS_PADDING = fallbacks.padding;

/** Links only exist for a new block, so this is a default, not a fallback. */
export const DEFAULT_SOCIALS_LINKS = [
  { type: "facebook" as const, url: "", icon: "/facebook.png" },
  { type: "twitter" as const, url: "", icon: "/twitter.png" },
  { type: "instagram" as const, url: "", icon: "/instagram.png" },
];

/** Editor-only: what the network picker offers and which icon it assigns. */
export const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  twitter: "Twitter",
  instagram: "Instagram",
  youtube: "YouTube",
  discord: "Discord",
  github: "GitHub",
  reddit: "Reddit",
};

export const SOCIAL_ICONS: Record<string, string> = {
  facebook: "/facebook.png",
  twitter: "/twitter.png",
  instagram: "/instagram.png",
  youtube: "/youtube.png",
  discord: "/discord.png",
  github: "/github.png",
  reddit: "/reddit.png",
};
