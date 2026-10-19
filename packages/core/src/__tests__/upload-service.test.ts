import { describe, it, expect, vi } from "vitest";
import { UploadService, detectImageType } from "../services/storage/uploadService";
import { ValidationError } from "../errors";

const pad = (head: number[]) => new Uint8Array([...head, ...new Array(Math.max(0, 16 - head.length)).fill(0)]);
const jpeg = pad([0xff, 0xd8, 0xff, 0xe0]);
const png = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const gif = pad([...Buffer.from("GIF89a")]);
const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0, 0, 0, 0]);
const svg = new Uint8Array(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"));

describe("detectImageType", () => {
  it("reads the magic bytes", () => {
    expect(detectImageType(jpeg)).toBe("jpg");
    expect(detectImageType(png)).toBe("png");
    expect(detectImageType(gif)).toBe("gif");
    expect(detectImageType(webp)).toBe("webp");
    expect(detectImageType(svg)).toBeNull();
    expect(detectImageType(new Uint8Array(3))).toBeNull();
  });
});

describe("UploadService", () => {
  it("refuses oversize and non-image files before touching storage", async () => {
    const put = vi.fn(async () => ({ url: "/u/x" }));
    const service = new UploadService({ put }, 32);
    expect(() => service.assertSize(33)).toThrow(ValidationError);
    await expect(service.storeImage(new Uint8Array(40))).rejects.toBeInstanceOf(ValidationError);
    await expect(service.storeImage(svg.subarray(0, 32))).rejects.toThrow(/Invalid file type/);
    expect(put).not.toHaveBeenCalled();
  });

  it("stores under a random name with the detected extension and type", async () => {
    const put = vi.fn(async (key: string) => ({ url: `/uploads/${key}` }));
    const service = new UploadService({ put });
    const { url } = await service.storeImage(png);
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{36}\.png$/), png, "image/png");
    expect(url).toMatch(/^\/uploads\/.*\.png$/);
  });
});
