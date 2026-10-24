// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";
import type { RenderLink } from "@senlo/features";

/**
 * How features components render a link in a Next.js host: through
 * `next/link`. Its own entry with no `"use client"`, so a server component
 * (a `not-found` page) can call it as well as a client one: imported from a
 * client module it would arrive on the server as a reference, not a function.
 */
export const nextRenderLink: RenderLink = (href, children, className) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);
