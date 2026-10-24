// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { startTransition, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createLogger } from "@senlo/core";
import {
  ErrorScreen,
  defaultSenloPaths,
  useOptionalSenloNavigation,
  type SenloPaths,
} from "@senlo/features";
import { nextRenderLink } from "./link";

const logger = createLogger();

/**
 * Where "back" goes. "workspace" and "triggers" need the workspace the page
 * belongs to (from the path), so they only fit pages inside one; without it
 * they fall back to the workspaces list.
 */
export type RouteErrorBack = "workspaces" | "workspace" | "triggers";

export interface RouteErrorOptions {
  title?: string;
  description?: string;
  back?: RouteErrorBack;
  /** For pages without the app shell (editor, unsubscribe, the root error). */
  fullScreen?: boolean;
}

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** The error screen's way back; exported for tests. */
export function routeErrorBackLink(target: RouteErrorBack | undefined, paths: SenloPaths, workspaceId: number | null) {
  if (!target) return undefined;
  if (target === "workspaces" || workspaceId === null) {
    return { href: paths.workspaces(), label: "Back to workspaces" };
  }
  if (target === "triggers") {
    return { href: paths.triggers(workspaceId), label: "Back to triggers" };
  }
  return { href: paths.dashboard(workspaceId), label: "Back to dashboard" };
}

/**
 * Builds a route's `error.tsx` component around the shared `ErrorScreen`:
 * logs the error, retries by refetching the server components too (a bare
 * `reset()` only re-renders what the client already has), shows the stack
 * in development and the digest otherwise. Works outside the app shell (the
 * unsubscribe page, the root error): the host's paths when a navigation
 * provider is above it, self-hosted's otherwise.
 *
 * ```ts
 * // app/(app)/workspace/[id]/triggers/error.tsx
 * "use client";
 * export default routeError({ back: "workspace" });
 * ```
 */
export function routeError(options: RouteErrorOptions = {}) {
  return function RouteError({ error, reset }: RouteErrorProps) {
    const router = useRouter();
    const pathname = usePathname() ?? "/";
    const paths = useOptionalSenloNavigation()?.paths ?? defaultSenloPaths;

    useEffect(() => {
      logger.error("Route error", { message: error.message, digest: error.digest });
    }, [error]);

    const retry = () =>
      startTransition(() => {
        router.refresh();
        reset();
      });

    const details =
      process.env.NODE_ENV === "development"
        ? [error.message, error.stack].filter(Boolean).join("\n\n")
        : undefined;

    return (
      <ErrorScreen
        title={options.title}
        description={options.description}
        onRetry={retry}
        back={routeErrorBackLink(options.back, paths, paths.workspaceIdFrom(pathname))}
        renderLink={nextRenderLink}
        details={details}
        reference={error.digest}
        fullScreen={options.fullScreen}
      />
    );
  };
}
