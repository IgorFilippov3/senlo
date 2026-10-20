import type { NextRequest } from "next/server";
import { handleProviderWebhook } from "@/lib/webhooks";

export async function POST(req: NextRequest) {
  return handleProviderWebhook(req, "POSTMARK");
}
