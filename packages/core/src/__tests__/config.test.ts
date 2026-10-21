import { describe, it, expect } from "vitest";
import { loadSenloConfig, ConfigError } from "../config";

const base = { DATABASE_URL: "postgres://x", AUTH_SECRET: "s" };

describe("loadSenloConfig", () => {
  it("fills defaults outside production", () => {
    expect(loadSenloConfig(base)).toEqual({
      appUrl: "http://localhost:3000",
      databaseUrl: "postgres://x",
      redisUrl: "redis://localhost:6379",
      queuePrefix: "senlo",
      linkSigningSecret: "s",
      secretsKey: "s",
      defaultFromEmail: "hello@senlo.io",
      storage: { driver: "local" },
    });
  });

  it("reads every variable and trims the app url", () => {
    const config = loadSenloConfig({
      ...base,
      APP_URL: "https://mail.example.com/",
      REDIS_URL: "redis://r:6379",
      REDIS_QUEUE_PREFIX: "acme",
      LINK_SIGNING_SECRET: "links",
      SECRETS_KEY: "vault",
      DEFAULT_FROM_EMAIL: "hi@example.com",
    });
    expect(config).toMatchObject({
      secretsKey: "vault",
      appUrl: "https://mail.example.com",
      redisUrl: "redis://r:6379",
      queuePrefix: "acme",
      linkSigningSecret: "links",
      defaultFromEmail: "hi@example.com",
    });
  });

  it("still accepts the old NEXT_PUBLIC_APP_URL name, APP_URL winning", () => {
    expect(loadSenloConfig({ ...base, NEXT_PUBLIC_APP_URL: "https://old.example" }).appUrl).toBe("https://old.example");
    expect(
      loadSenloConfig({ ...base, NEXT_PUBLIC_APP_URL: "https://old.example", APP_URL: "https://new.example" }).appUrl,
    ).toBe("https://new.example");
  });

  it("requires APP_URL in production", () => {
    expect(() => loadSenloConfig({ ...base, NODE_ENV: "production" })).toThrow(/APP_URL is not set/);
  });

  it("lists every problem at once", () => {
    try {
      loadSenloConfig({ NODE_ENV: "production", DEFAULT_FROM_EMAIL: "Name <x@y.z>", APP_URL: "mail.example.com" });
      throw new Error("expected a ConfigError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).problems).toHaveLength(4);
      expect((error as Error).message).toMatch(/DATABASE_URL[\s\S]*AUTH_SECRET/);
    }
  });

  it("treats blank values as missing", () => {
    expect(() => loadSenloConfig({ DATABASE_URL: "  ", AUTH_SECRET: "s" })).toThrow(/DATABASE_URL/);
  });

  it("returns a frozen object", () => {
    expect(Object.isFrozen(loadSenloConfig(base))).toBe(true);
  });

  describe("storage", () => {
    const s3 = { ...base, STORAGE_DRIVER: "s3", S3_BUCKET: "b", S3_REGION: "eu-central-1", S3_ACCESS_KEY_ID: "ak", S3_SECRET_ACCESS_KEY: "sk" };

    it("derives the AWS public URL and virtual-hosted style without an endpoint", () => {
      expect(loadSenloConfig(s3).storage).toEqual({
        driver: "s3", bucket: "b", region: "eu-central-1", endpoint: null, accessKeyId: "ak", secretAccessKey: "sk",
        publicUrl: "https://b.s3.eu-central-1.amazonaws.com", keyPrefix: "", forcePathStyle: false,
      });
    });

    it("needs a public URL with a custom endpoint and defaults to path style there", () => {
      expect(() => loadSenloConfig({ ...s3, S3_ENDPOINT: "https://acc.r2.cloudflarestorage.com" })).toThrow(/S3_PUBLIC_URL/);
      expect(
        loadSenloConfig({ ...s3, S3_ENDPOINT: "https://acc.r2.cloudflarestorage.com/", S3_PUBLIC_URL: "https://files.example.com/", S3_KEY_PREFIX: "/uploads/" }).storage,
      ).toMatchObject({ endpoint: "https://acc.r2.cloudflarestorage.com", publicUrl: "https://files.example.com", keyPrefix: "uploads", forcePathStyle: true });
    });

    it("lists the missing S3 variables and refuses an unknown driver", () => {
      try {
        loadSenloConfig({ ...base, STORAGE_DRIVER: "s3" });
        throw new Error("expected a ConfigError");
      } catch (error) {
        expect((error as ConfigError).problems.filter((p) => p.startsWith("S3_"))).toHaveLength(4);
      }
      expect(() => loadSenloConfig({ ...base, STORAGE_DRIVER: "gcs" })).toThrow(/STORAGE_DRIVER/);
    });
  });
});
