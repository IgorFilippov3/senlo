import { describe, it, expect } from "vitest";
import {
  sealTrackingToken,
  openTrackingToken,
  clickSignature,
  verifyClickSignature,
  trackingUrls,
} from "../tracking-token";

const SECRET = "test-secret";

describe("tracking tokens", () => {
  it("round-trips the recipient", async () => {
    const token = await sealTrackingToken({ campaignId: 42, email: "ann@example.com" }, SECRET);
    expect(await openTrackingToken(token, SECRET)).toEqual({ campaignId: 42, email: "ann@example.com" });
  });

  it("does not show the address in the token", async () => {
    const token = await sealTrackingToken({ campaignId: 42, email: "ann@example.com" }, SECRET);
    expect(token).not.toContain("ann");
    expect(Buffer.from(token, "base64url").toString("latin1")).not.toContain("example.com");
  });

  it("produces a different token each time, so tokens cannot be compared", async () => {
    const data = { campaignId: 42, email: "ann@example.com" };
    expect(await sealTrackingToken(data, SECRET)).not.toBe(await sealTrackingToken(data, SECRET));
  });

  it("refuses a token that was altered, truncated or sealed with another secret", async () => {
    const token = await sealTrackingToken({ campaignId: 42, email: "ann@example.com" }, SECRET);
    const flipped = token.slice(0, 20) + (token[20] === "A" ? "B" : "A") + token.slice(21);

    expect(await openTrackingToken(flipped, SECRET)).toBeNull();
    expect(await openTrackingToken(token.slice(0, -4), SECRET)).toBeNull();
    expect(await openTrackingToken(token, "other")).toBeNull();
    expect(await openTrackingToken("", SECRET)).toBeNull();
    expect(await openTrackingToken("not a token!", SECRET)).toBeNull();
  });

  it("is safe in a path segment", async () => {
    const token = await sealTrackingToken({ campaignId: 1, email: "a@b.c" }, SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("click signatures", () => {
  it("verifies only the exact token, destination and secret", async () => {
    const signature = await clickSignature("TOK", "https://a.com", SECRET);

    expect(await verifyClickSignature("TOK", "https://a.com", signature, SECRET)).toBe(true);
    expect(await verifyClickSignature("TOK", "https://a.com/", signature, SECRET)).toBe(false);
    expect(await verifyClickSignature("TOK2", "https://a.com", signature, SECRET)).toBe(false);
    expect(await verifyClickSignature("TOK", "https://a.com", signature, "other")).toBe(false);
    expect(await verifyClickSignature("TOK", "https://a.com", "", SECRET)).toBe(false);
  });
});

describe("trackingUrls", () => {
  it("builds the open and click endpoints", () => {
    expect(trackingUrls("https://senlo.io", "TOK")).toEqual({
      open: "https://senlo.io/api/t/o/TOK",
      click: "https://senlo.io/api/t/c/TOK",
    });
  });
});
