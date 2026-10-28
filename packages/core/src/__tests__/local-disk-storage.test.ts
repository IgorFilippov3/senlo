import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDiskStorage } from "../services/storage/localDiskStorage";
import { isUploadKey } from "../services/storage/uploadService";

const KEY = "0f8fad5b-d9cb-469f-a165-70867728950e.png";

describe("LocalDiskStorage", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "senlo-uploads-"));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("writes the file and answers with the public URL", async () => {
    const storage = new LocalDiskStorage(join(dir, "nested"), "/uploads/");
    expect(await storage.put(KEY, new Uint8Array([1, 2, 3]))).toEqual({ url: `/uploads/${KEY}` });
    expect(await storage.stat(KEY)).toEqual({ path: join(dir, "nested", KEY), size: 3, contentType: "image/png" });
  });

  it("finds files written after it was created, not only those present at startup", async () => {
    const storage = new LocalDiskStorage(dir, "/uploads");
    const later = "7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg";
    expect(await storage.stat(later)).toBeNull();
    await writeFile(join(dir, later), new Uint8Array([0xff, 0xd8, 0xff]));
    expect(await storage.stat(later)).toMatchObject({ size: 3, contentType: "image/jpeg" });
  });

  it("answers null for a missing file or a key it would never have produced", async () => {
    const storage = new LocalDiskStorage(dir, "/uploads");
    await writeFile(join(dir, "secret.txt"), "x");
    expect(await storage.stat("00000000-0000-0000-0000-000000000000.png")).toBeNull();
    expect(await storage.stat("secret.txt")).toBeNull();
    expect(await storage.stat("../secret.txt")).toBeNull();
    expect(await storage.stat(`../${KEY}`)).toBeNull();
    expect(await storage.stat("")).toBeNull();
  });
});

describe("isUploadKey", () => {
  it("accepts a UUID with an image extension and nothing else", () => {
    expect(isUploadKey(KEY)).toBe(true);
    expect(isUploadKey(KEY.toUpperCase())).toBe(true);
    expect(isUploadKey("0f8fad5b-d9cb-469f-a165-70867728950e.svg")).toBe(false);
    expect(isUploadKey("qEZdlARCxsaeimJ_H7lkE.jpg")).toBe(false);
    expect(isUploadKey("a/b.png")).toBe(false);
  });
});
