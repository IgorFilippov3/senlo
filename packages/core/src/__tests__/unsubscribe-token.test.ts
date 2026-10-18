import { describe, it, expect } from "vitest";
import {
  encodeUnsubscribeToken,
  decodeUnsubscribeToken,
  buildUnsubscribeHeaders,
  unsubscribeUrls,
} from "../unsubscribe-token";
import { encodeJson, signPayload } from "../signing";

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

  it("does not reveal the recipient's address", async () => {
    const token = await encodeUnsubscribeToken(
      { projectId: 1, email: "ann@example.com", campaignId: 42 },
      SECRET,
    );
    expect(token).not.toContain(".");
    expect(Buffer.from(token, "base64url").toString("latin1")).not.toContain("example.com");
  });

  it("treats an altered sealed token as nothing it can trust", async () => {
    const token = await encodeUnsubscribeToken({ contactId: 7, campaignId: 42 }, SECRET);
    const flipped = token.slice(0, 20) + (token[20] === "A" ? "B" : "A") + token.slice(21);

    // Not a valid seal and not legacy JSON either.
    expect(await decodeUnsubscribeToken(flipped, SECRET)).toBeNull();
  });

  it("refuses a token sealed with another secret", async () => {
    const token = await encodeUnsubscribeToken({ contactId: 7, campaignId: 42 }, "other");
    expect(await decodeUnsubscribeToken(token, SECRET)).toBeNull();
  });

  describe("signed tokens from mail sent before sealing", () => {
    const signed = async (data: unknown, secret = SECRET) => {
      const payload = encodeJson(data);
      return `${payload}.${await signPayload(payload, secret)}`;
    };

    it("are still trusted when the signature matches", async () => {
      const data = { contactId: 7, campaignId: 42 };
      expect(await decodeUnsubscribeToken(await signed(data), SECRET)).toEqual({ data, signed: true });
    });

    it("are refused when the ids were edited or the signature mangled", async () => {
      const token = await signed({ contactId: 7, campaignId: 42 });
      const [, signature] = token.split(".");

      expect(await decodeUnsubscribeToken(`${legacy({ contactId: 8, campaignId: 42 })}.${signature}`, SECRET)).toBeNull();
      expect(await decodeUnsubscribeToken(`${token}x`, SECRET)).toBeNull();
      expect(await decodeUnsubscribeToken(`${token}.extra`, SECRET)).toBeNull();
      expect(await decodeUnsubscribeToken(await signed({ contactId: 7, campaignId: 42 }, "other"), SECRET)).toBeNull();
    });
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
