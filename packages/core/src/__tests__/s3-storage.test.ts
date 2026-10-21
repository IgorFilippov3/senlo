import { describe, it, expect, vi } from "vitest";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Storage, s3ObjectKey, s3PublicUrl } from "../services/storage/s3Storage";
import { storageFromConfig } from "../services/storage/storageFromConfig";
import { LocalDiskStorage } from "../services/storage/localDiskStorage";
import type { S3StorageConfig } from "../config";

const config: S3StorageConfig = {
  driver: "s3", bucket: "senlo", region: "auto", endpoint: "https://acc.r2.cloudflarestorage.com",
  accessKeyId: "ak", secretAccessKey: "sk", publicUrl: "https://files.example.com/", keyPrefix: "uploads", forcePathStyle: true,
};

describe("S3Storage", () => {
  it("builds the object key and public URL", () => {
    expect(s3ObjectKey("", "a.png")).toBe("a.png");
    expect(s3ObjectKey("uploads", "a.png")).toBe("uploads/a.png");
    expect(s3PublicUrl("https://files.example.com/", "uploads/a.png")).toBe("https://files.example.com/uploads/a.png");
  });

  it("puts the bytes with their content type and answers with the public URL", async () => {
    const client = { send: vi.fn(async (_command: PutObjectCommand) => ({})) };
    const storage = new S3Storage(config, client);
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await storage.put("a.png", bytes, "image/png")).toEqual({ url: "https://files.example.com/uploads/a.png" });
    const command = client.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({ Bucket: "senlo", Key: "uploads/a.png", Body: bytes, ContentType: "image/png" });
    expect(command.input.ACL).toBeUndefined();
  });

  it("is what the config picks", () => {
    const local = { rootDir: "/tmp/x", publicPrefix: "/uploads" };
    expect(storageFromConfig({ driver: "local" }, local)).toBeInstanceOf(LocalDiskStorage);
    expect(storageFromConfig(config, local)).toBeInstanceOf(S3Storage);
  });
});
