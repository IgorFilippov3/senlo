// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "@senlo/ui/styles.css";
import Script from "next/script";
import { getConfig } from "../lib/config";

// @senlo/ui's `--sl-font-sans` / `--sl-font-mono` read these two variables on <html>.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/**
 * Rendered per request, so values from the runtime config - demo mode, the
 * analytics id, the app URL - are what the server has now, not what the build
 * machine had. Nearly every page is behind a login and dynamic anyway.
 */
export const dynamic = "force-dynamic";

const baseMetadata: Metadata = {
  title: "Senlo — Open-Source Email Trigger Infrastructure",
  description:
    "A modern, self-hosted alternative to Postmark and Resend. Open-source email trigger infrastructure with a visual MJML editor.",
  keywords: [
    "email triggers",
    "email infrastructure",
    "email builder",
    "email templates",
    "postmark alternative",
    "resend alternative",
    "open source",
    "self-hosted",
    "mjml editor",
  ],
  authors: [{ name: "Igor Filippov" }],
  creator: "Igor Filippov",
  publisher: "Igor Filippov",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Senlo — Open-Source Email Trigger Infrastructure",
    description:
      "A modern, self-hosted alternative to Postmark and Resend. Open-source email trigger infrastructure with a visual MJML editor.",
    siteName: "Senlo",
    images: [
      {
        url: "/core/logo-preview.png",
        width: 1200,
        height: 630,
        alt: "Senlo — Email Trigger Infrastructure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Senlo — Open-Source Email Trigger Infrastructure",
    description:
      "A modern, self-hosted alternative to Postmark and Resend. Open-source email trigger infrastructure with a visual MJML editor.",
    images: ["/core/logo-preview.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export function generateMetadata(): Metadata {
  return { ...baseMetadata, metadataBase: new URL(getConfig().appUrl) };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { demoMode, umamiWebsiteId } = getConfig();

  return (
    <html lang="en" className={`${hanken.variable} ${plexMono.variable}`}>
      <body className="antialiased">
        {demoMode && umamiWebsiteId && (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id={umamiWebsiteId}
            strategy="afterInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
