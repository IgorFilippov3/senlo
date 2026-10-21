// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { S3StorageConfig } from "../../config";
import type { StoragePort } from "./storagePort";

/** The one call the adapter makes, so a test can stand in for the SDK client. */
export interface S3PutClient {
  send(command: PutObjectCommand): Promise<unknown>;
}

/** The object key for an upload: the configured prefix, then the service's name. */
export function s3ObjectKey(keyPrefix: string, key: string): string {
  return keyPrefix ? `${keyPrefix}/${key}` : key;
}

/** Where the object is served from: `publicUrl` is the base, the object key is the path. */
export function s3PublicUrl(publicUrl: string, objectKey: string): string {
  return `${publicUrl.replace(/\/+$/, "")}/${objectKey}`;
}

/**
 * Uploads to an S3 bucket or an S3-compatible service (Cloudflare R2, MinIO).
 * Objects are written public-readable only through the bucket's own policy or
 * the public URL in front of it; the adapter sets no ACL, because R2 and
 * buckets with "object ownership enforced" refuse one.
 */
export class S3Storage implements StoragePort {
  private readonly client: S3PutClient;

  constructor(
    private readonly config: S3StorageConfig,
    client?: S3PutClient,
  ) {
    this.client =
      client ??
      new S3Client({
        region: config.region,
        endpoint: config.endpoint ?? undefined,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }> {
    const objectKey = s3ObjectKey(this.config.keyPrefix, key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: contentType,
        // Uploads are immutable (random names), so clients may cache for good.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { url: s3PublicUrl(this.config.publicUrl, objectKey) };
  }
}
