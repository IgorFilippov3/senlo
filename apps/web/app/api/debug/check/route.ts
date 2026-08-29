import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint for testing Automation "API Check" nodes.
 *
 * Logic:
 * - Returns 200 (YES) if:
 *   - The email contains "pass"
 *   - OR meta.test_check is true
 * - Returns 400 (NO) otherwise.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log(
      "[Debug API] Full Body Received:",
      JSON.stringify(body, null, 2),
    );

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

    console.log("[Debug API] Decision details:", {
      emailPass: email?.includes("pass"),
      testCheck: effectiveMetadata.test_check === true,
      tagsPass:
        Array.isArray(effectiveMetadata.tags) &&
        effectiveMetadata.tags.includes("test-pass"),
      tagsFound: effectiveMetadata.tags,
      shouldPass,
    });

    console.log("[Debug API] Decision:", shouldPass ? "YES" : "NO");

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
