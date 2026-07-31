// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@senlo/ui/styles.css";
import Script from "next/script";
import { IS_DEMO_MODE, UMAMI_WEBSITE_ID } from "../lib";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
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
        url: "/logo-preview.png",
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
    images: ["/logo-preview.png"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {IS_DEMO_MODE && UMAMI_WEBSITE_ID && (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id={UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
