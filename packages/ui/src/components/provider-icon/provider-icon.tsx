import React from "react";
import { Server } from "lucide-react";
import { cn } from "../../lib/cn";
import { PROVIDER_LOGOS } from "./provider-logos";
import styles from "./provider-icon.module.css";

/** Letters shown until a provider's own mark is added to `PROVIDER_LOGOS`. */
const MONOGRAMS: Record<string, string> = {
  RESEND: "R",
  SES: "SES",
  POSTMARK: "P",
  SENDGRID: "SG",
  MAILJET: "MJ",
  MAILGUN: "MG",
  CLOUDFLARE: "CF",
};

/** The letters for a provider type: its own, or the first two of an unknown type. */
export function providerMonogram(type: string): string {
  const key = type.toUpperCase();
  return MONOGRAMS[key] ?? key.replace(/[^A-Z0-9]/g, "").slice(0, 2);
}

export interface ProviderIconProps {
  /** The email provider's type, as stored: `RESEND`, `SES`, `SMTP`... Case does not matter. */
  type: string;
  /** Side of the square, in px. */
  size?: number;
  /** Draw the icon in a bordered box of its own; without it the icon sits on whatever is behind it. */
  tile?: boolean;
  className?: string;
}

/**
 * An email provider's icon: its own mark if one is registered, a monogram
 * otherwise, a server glyph for plain SMTP. Decorative: always next to the
 * provider's name, so it is hidden from screen readers. No hooks, so it
 * renders in server components too (a host's marketing pages).
 */
export function ProviderIcon({ type, size = 20, tile = false, className }: ProviderIconProps) {
  const key = type.toUpperCase();
  const Logo = PROVIDER_LOGOS[key];
  const letters = providerMonogram(key);
  // Three letters need a smaller face than one to fit the same square.
  const fontSize = Math.round(size * (tile ? 0.5 : 0.62) * (letters.length > 2 ? 0.72 : letters.length > 1 ? 0.88 : 1));

  return (
    <span
      aria-hidden="true"
      data-provider={key}
      className={cn(styles.icon, tile && styles.tile, className)}
      style={{ width: size, height: size }}
    >
      {Logo ? (
        <Logo />
      ) : key === "SMTP" ? (
        <Server />
      ) : (
        <span className={styles.monogram} style={{ fontSize }}>
          {letters}
        </span>
      )}
    </span>
  );
}
