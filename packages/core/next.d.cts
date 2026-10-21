// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Every @senlo/* package ships TypeScript source, so a Next.js host transpiles all of them. */
export declare const SENLO_TRANSPILE_PACKAGES: readonly string[];

/** Adds the Senlo packages to `transpilePackages`, keeping the app's own entries. */
export declare function withSenlo<T extends { transpilePackages?: string[] }>(
  config?: T,
): T & { transpilePackages: string[] };
