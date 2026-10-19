import type { NextRequest } from "next/server";
import { handleProviderWebhook } from "apps/web/lib/webhooks";

export async function POST(req: NextRequest) {
  return handleProviderWebhook(req, "RESEND");
}
