// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Senlo — Open-Source Email Marketing Infrastructure",
  description:
    "A modern, self-hosted alternative to Mailchimp and Brevo. Open-source email marketing infrastructure for building, managing, and sending campaigns.",
  keywords: [
    "email marketing infrastructure",
    "email builder",
    "email templates",
    "brevo alternative",
    "mailchimp alternative",
    "open source",
    "self-hosted",
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
    title: "Senlo — Open-Source Email Marketing Infrastructure",
    description:
      "A modern, self-hosted alternative to Mailchimp and Brevo. Open-source email marketing infrastructure for building, managing, and sending campaigns.",
    siteName: "Senlo",
    images: [
      {
        url: "/logo-preview.png",
        width: 1200,
        height: 630,
        alt: "Senlo — Email Marketing Infrastructure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Senlo — Open-Source Email Marketing Infrastructure",
    description:
      "A modern, self-hosted alternative to Mailchimp and Brevo. Open-source email marketing infrastructure for building, managing, and sending campaigns.",
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
        {children}
      </body>
    </html>
  );
}
