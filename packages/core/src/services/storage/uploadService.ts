// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ValidationError } from "../../errors";
import type { StoragePort } from "./storagePort";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
} as const;

type ImageExtension = keyof typeof IMAGE_TYPES;

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/**
 * The image type from the file's own bytes, never from the browser's claim.
 * SVG is not accepted: it can carry script, and uploads are served from the
 * app's own origin.
 */
export function detectImageType(bytes: Uint8Array): ImageExtension | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => bytes[i] === b)) return "png";
  const head6 = ascii(bytes, 0, 6);
  if (head6 === "GIF87a" || head6 === "GIF89a") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  return null;
}

/** Image uploads from the editor: checked, renamed, handed to storage. */
export class UploadService {
  constructor(
    private readonly storage: StoragePort,
    private readonly maxBytes: number = MAX_UPLOAD_BYTES,
  ) {}

  /** `declaredSize` lets the caller refuse before reading the whole file. */
  assertSize(declaredSize: number): void {
    if (declaredSize > this.maxBytes) {
      throw new ValidationError(
        `File too large. Max size is ${Math.round(this.maxBytes / 1024 / 1024)}MB.`,
      );
    }
  }

  async storeImage(bytes: Uint8Array): Promise<{ url: string }> {
    this.assertSize(bytes.byteLength);
    const extension = detectImageType(bytes);
    if (!extension) {
      throw new ValidationError("Invalid file type. Upload a JPEG, PNG, GIF or WebP image.");
    }
    const key = `${crypto.randomUUID()}.${extension}`;
    return this.storage.put(key, bytes, IMAGE_TYPES[extension]);
  }
}
