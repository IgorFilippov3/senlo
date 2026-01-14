import { NextRequest, NextResponse } from "next/server";
import { ApiKeyRepository } from "@senlo/db";
import { ApiKey } from "@senlo/core";

const apiKeyRepo = new ApiKeyRepository();

export type ApiAuthResult =
  | { success: true; apiKey: ApiKey }
  | { success: false; response: NextResponse };

/**
 * Validates the API key from the Authorization header.
 * Returns the API key object if valid, or a NextResponse with an error if invalid.
 */
export async function validateApiKey(req: NextRequest): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("Authorization");

  console.log(authHeader, "authHeader");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      ),
    };
  }

  const key = authHeader.split(" ")[1];
  const apiKey = await apiKeyRepo.findByKey(key);

  if (!apiKey) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      ),
    };
  }

  void apiKeyRepo.updateLastUsed(apiKey.id);

  return { success: true, apiKey };
}
