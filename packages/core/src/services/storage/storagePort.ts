// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Where uploaded files go. Self-hosted writes to the app's own disk; a
 * managed install plugs in object storage. The key is a path-like name the
 * service chose; the adapter answers with the public URL.
 */
export interface StoragePort {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<{ url: string }>;
}
