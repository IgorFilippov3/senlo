import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint for testing Automation "API Check" nodes.
 *
 * Logic:
 * - Returns 200 (YES) if:
 *   - The email contains "pass"
 *   - OR meta.test_check is true
 * - Returns 400 (NO) otherwise.
 *
 * Public on purpose: the automation worker calls it server to server, and the
 * builder suggests it for testing branches. It reads nothing but the request.
 */
export async function POST(req: NextRequest) {
  try {
    // Not logged: the body is a real contact's email and metadata.
    const body = await req.json();

    const { email, metadata, meta } = body;
    // Handle cases where metadata might be a string (if jsonb parsing fails somewhere)
    let effectiveMetadata = metadata || meta || {};
    if (typeof effectiveMetadata === "string") {
      try {
        effectiveMetadata = JSON.parse(effectiveMetadata);
      } catch (e) {
        effectiveMetadata = {};
      }
    }

    const shouldPass =
      (email && email.includes("pass")) ||
      effectiveMetadata.test_check === true ||
      (Array.isArray(effectiveMetadata.tags) &&
        effectiveMetadata.tags.includes("test-pass"));

    if (shouldPass) {
      return NextResponse.json(
        { result: "YES", message: "Debug check passed" },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { result: "NO", message: "Debug check failed" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 500 });
  }
}
