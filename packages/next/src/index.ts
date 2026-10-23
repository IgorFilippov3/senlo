// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Server side of the Next.js adapter. A host (self-hosted `apps/web`, the
 * managed app) builds one `SenloHost` in its composition root and gets from
 * here everything that is the same in every host: route handlers, the
 * action transport, error mapping, rate limits and page loaders.
 *
 * Core, ui, features and editor stay free of Next; this package is the one
 * place that imports it. Filled in by phase 8 of the managed plan.
 */
export {};
