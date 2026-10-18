import { NextRequest, NextResponse } from "next/server";
import { CampaignRepository } from "@senlo/db";
import { db } from "apps/web/lib/db";
import { TrackingService } from "@senlo/core/server";

export const trackingService = new TrackingService(new CampaignRepository(db));

// 1x1 transparent GIF
const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export function pixelResponse(): NextResponse {
  return new NextResponse(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export function requestMetadata(request: NextRequest) {
  return {
    userAgent: request.headers.get("user-agent") || "unknown",
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown",
  };
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Shown instead of a redirect when a link's destination cannot be vouched
 * for. The recipient still gets there with one click, but nobody can use the
 * sender's domain to bounce people to an address of their choosing unseen.
 */
export function confirmLeavingResponse(url: string): NextResponse {
  const safe = /^https?:\/\//i.test(url) ? escapeHtml(url) : null;
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Leaving this email</title></head>
<body style="font-family:Arial,sans-serif;max-width:480px;margin:64px auto;padding:0 16px;color:#111827">
<h1 style="font-size:20px">This link could not be verified</h1>
${
  safe
    ? `<p>It points to:</p><p style="word-break:break-all"><a href="${safe}" rel="noopener noreferrer nofollow">${safe}</a></p><p style="color:#6b7280">Continue only if you expected to go there.</p>`
    : `<p style="color:#6b7280">The destination is not a web address.</p>`
}
</body></html>`;
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
