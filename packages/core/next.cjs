// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Next.js integration for a host app (self-hosted `apps/web`, the managed
// app). CommonJS on purpose: `next.config.ts` is compiled to CommonJS unless
// the app is `"type": "module"`, and Node 20 cannot `require()` an ES module.
"use strict";

/** Every @senlo/* package ships TypeScript source, so a Next.js host transpiles all of them. */
const SENLO_TRANSPILE_PACKAGES = [
  "@senlo/automation-builder",
  "@senlo/core",
  "@senlo/db",
  "@senlo/editor",
  "@senlo/features",
  "@senlo/next",
  "@senlo/ui",
];

/** Adds the Senlo packages to `transpilePackages`, keeping the app's own entries. */
function withSenlo(config) {
  const base = config || {};
  const own = base.transpilePackages || [];
  return Object.assign({}, base, {
    transpilePackages: Array.from(new Set(SENLO_TRANSPILE_PACKAGES.concat(own))),
  });
}

exports.SENLO_TRANSPILE_PACKAGES = SENLO_TRANSPILE_PACKAGES;
exports.withSenlo = withSenlo;
