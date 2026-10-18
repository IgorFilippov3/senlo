import { describe, it, expect } from "vitest";
import {
  encodeUnsubscribeToken,
  decodeUnsubscribeToken,
  buildUnsubscribeHeaders,
  unsubscribeUrls,
} from "../unsubscribe-token";
import { resolveSigningSecret } from "../signing";

const SECRET = "test-secret";
const legacy = (data: unknown) =>
  Buffer.from(JSON.stringify(data)).toString("base64url");

describe("unsubscribe tokens", () => {
  it("round-trips a campaign recipient as a signed token", async () => {
    const data = { contactId: 7, projectId: 1, email: "ann@example.com", campaignId: 42 };
    const token = await encodeUnsubscribeToken(data, SECRET);

    expect(await decodeUnsubscribeToken(token, SECRET)).toEqual({ data, signed: true });
  });

  it("round-trips a triggered recipient that has no contact row", async () => {
    const token = await encodeUnsubscribeToken(
      { projectId: 1, email: "ann@example.com", campaignId: 42 },
      SECRET,
    );
    expect((await decodeUnsubscribeToken(token, SECRET))?.data.email).toBe("ann@example.com");
  });

  it("refuses a token whose ids were edited", async () => {
    const token = await encodeUnsubscribeToken({ contactId: 7, campaignId: 42 }, SECRET);
    const [, signature] = token.split(".");
    const forged = `${legacy({ contactId: 8, campaignId: 42 })}.${signature}`;

    expect(await decodeUnsubscribeToken(forged, SECRET)).toBeNull();
  });

  it("refuses a token signed with another secret", async () => {
    const token = await encodeUnsubscribeToken({ contactId: 7, campaignId: 42 }, "other");
    expect(await decodeUnsubscribeToken(token, SECRET)).toBeNull();
  });

  it("refuses a signed token with a mangled signature", async () => {
    const token = await encodeUnsubscribeToken({ contactId: 7, campaignId: 42 }, SECRET);
    expect(await decodeUnsubscribeToken(`${token}x`, SECRET)).toBeNull();
    expect(await decodeUnsubscribeToken(`${token.split(".")[0]}.`, SECRET)).toBeNull();
    expect(await decodeUnsubscribeToken(`${token}.extra`, SECRET)).toBeNull();
  });

  it("reads a legacy unsigned token but marks it unsigned", async () => {
    expect(await decodeUnsubscribeToken(legacy({ contactId: 7, campaignId: 42 }), SECRET)).toEqual({
      data: { contactId: 7, campaignId: 42 },
      signed: false,
    });
  });

  it("rejects a token that identifies nobody", async () => {
    expect(await decodeUnsubscribeToken(legacy({ campaignId: 42 }), SECRET)).toBeNull();
    expect(await decodeUnsubscribeToken("not-a-token", SECRET)).toBeNull();
    expect(await decodeUnsubscribeToken("", SECRET)).toBeNull();
  });

  it("produces a token safe in a path segment", async () => {
    const token = await encodeUnsubscribeToken({ contactId: 7, campaignId: 42 }, SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

describe("resolveSigningSecret", () => {
  it("prefers LINK_SIGNING_SECRET, falls back to AUTH_SECRET", () => {
    expect(resolveSigningSecret({ LINK_SIGNING_SECRET: "a", AUTH_SECRET: "b" })).toBe("a");
    expect(resolveSigningSecret({ AUTH_SECRET: "b" })).toBe("b");
  });

  it("refuses to sign with no secret at all", () => {
    expect(() => resolveSigningSecret({})).toThrow(/AUTH_SECRET/);
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
