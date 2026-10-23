import { pixelResponse } from "@senlo/next";

/**
 * Open pixel from mail sent before tracking links were sealed. Its campaign
 * and address sit in the URL in the clear, so anyone could count opens for
 * any campaign through it: it still answers with an image, but records
 * nothing. New mail uses `/api/t/o/[token]`.
 */
export async function GET() {
  return pixelResponse();
}
