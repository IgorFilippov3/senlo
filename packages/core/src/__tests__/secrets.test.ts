import { describe, it, expect } from "vitest";
import {
  aesGcmCipher,
  isSealedEnvelope,
  openConfig,
  sealConfig,
  SealedConfigError,
  SEALED_KEY,
} from "../secrets";

const cipher = aesGcmCipher("key-one");
const config = { apiKey: "re_123", fromEmail: "a@b.co", nested: { port: 587 } };

describe("sealConfig / openConfig", () => {
  it("round-trips a config through an envelope that does not carry the plain values", async () => {
    const stored = await sealConfig(cipher, config);
    expect(isSealedEnvelope(stored)).toBe(true);
    expect(Object.keys(stored)).toEqual([SEALED_KEY]);
    expect(JSON.stringify(stored)).not.toContain("re_123");
    expect(await openConfig(cipher, stored)).toEqual(config);
  });

  it("seals the same config differently every time", async () => {
    const a = await sealConfig(cipher, config);
    const b = await sealConfig(cipher, config);
    expect(a[SEALED_KEY]).not.toBe(b[SEALED_KEY]);
  });

  it("passes a legacy plain config through", async () => {
    expect(await openConfig(cipher, config)).toEqual(config);
    expect(isSealedEnvelope(config)).toBe(false);
  });

  it("refuses a sealed config under another key, an altered token and a non-object", async () => {
    const stored = await sealConfig(cipher, config);
    await expect(openConfig(aesGcmCipher("key-two"), stored)).rejects.toBeInstanceOf(SealedConfigError);
    const altered = { [SEALED_KEY]: stored[SEALED_KEY].slice(0, -2) + "AA" };
    await expect(openConfig(cipher, altered)).rejects.toBeInstanceOf(SealedConfigError);
    await expect(openConfig(cipher, "nope")).rejects.toBeInstanceOf(SealedConfigError);
    await expect(openConfig(cipher, null)).rejects.toBeInstanceOf(SealedConfigError);
  });

  it("needs a secret", () => {
    expect(() => aesGcmCipher("")).toThrow();
  });
});
