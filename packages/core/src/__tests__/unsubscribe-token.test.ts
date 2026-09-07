import { describe, it, expect } from "vitest";
import {
  encodeUnsubscribeToken,
  decodeUnsubscribeToken,
  buildUnsubscribeHeaders,
  unsubscribeUrls,
} from "../unsubscribe-token";

describe("unsubscribe tokens", () => {
  it("round-trips a campaign recipient", () => {
    const token = encodeUnsubscribeToken({
      contactId: 7,
      projectId: 1,
      email: "ann@example.com",
      campaignId: 42,
    });

    expect(decodeUnsubscribeToken(token)).toEqual({
      contactId: 7,
      projectId: 1,
      email: "ann@example.com",
      campaignId: 42,
    });
  });

  it("round-trips a triggered recipient that has no contact row", () => {
    const token = encodeUnsubscribeToken({
      projectId: 1,
      email: "ann@example.com",
      campaignId: 42,
    });

    expect(decodeUnsubscribeToken(token)?.email).toBe("ann@example.com");
  });

  it("still reads a token issued before the shape changed", () => {
    const legacy = Buffer.from(
      JSON.stringify({ contactId: 7, campaignId: 42 }),
    ).toString("base64url");

    expect(decodeUnsubscribeToken(legacy)).toEqual({
      contactId: 7,
      campaignId: 42,
    });
  });

  it("rejects a token that identifies nobody", () => {
    const bad = Buffer.from(JSON.stringify({ campaignId: 42 })).toString(
      "base64url",
    );

    expect(decodeUnsubscribeToken(bad)).toBeNull();
    expect(decodeUnsubscribeToken("not-a-token")).toBeNull();
    expect(decodeUnsubscribeToken("")).toBeNull();
  });

  it("produces a url safe in a path segment", () => {
    const token = encodeUnsubscribeToken({ contactId: 7, campaignId: 42 });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("buildUnsubscribeHeaders", () => {
  it("asks for one-click handling", () => {
    expect(
      buildUnsubscribeHeaders("https://senlo.io/api/unsubscribe/abc"),
    ).toEqual({
      "List-Unsubscribe": "<https://senlo.io/api/unsubscribe/abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("returns nothing when there is no url", () => {
    expect(buildUnsubscribeHeaders(undefined)).toBeUndefined();
  });
});

describe("unsubscribeUrls", () => {
  it("points the page at the route that exists and one-click at the API", () => {
    expect(unsubscribeUrls("https://senlo.io", "abc")).toEqual({
      page: "https://senlo.io/unsubscribe/abc",
      oneClick: "https://senlo.io/api/unsubscribe/abc",
    });
  });
});
