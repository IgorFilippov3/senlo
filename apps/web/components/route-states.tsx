"use client";

import { startTransition, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ErrorScreen, workspaceHomePath } from "@senlo/features";
import { logger } from "apps/web/lib/logger";
import { renderLink } from "apps/web/components/link";

/**
 * Where "back" goes. "workspace" and "triggers" read the workspace id from the
 * route's `[id]`, so they only fit routes under `/workspace/[id]`.
 */
type BackTarget = "workspaces" | "workspace" | "triggers";

interface RouteErrorOptions {
  title?: string;
  description?: string;
  back?: BackTarget;
  /** For pages without the app shell (editor, unsubscribe). */
  fullScreen?: boolean;
}

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function backLink(target: BackTarget | undefined, workspaceId: number) {
  if (!target) return undefined;
  if (target === "workspaces" || !workspaceId) {
    return { href: "/workspaces", label: "Back to workspaces" };
  }
  if (target === "triggers") {
    return { href: `/workspace/${workspaceId}/triggers`, label: "Back to triggers" };
  }
  return { href: workspaceHomePath(workspaceId), label: "Back to dashboard" };
}

/**
 * Builds a route's `error.tsx` component around the shared `ErrorScreen`:
 * logs the error, retries by refetching the server components too (a bare
 * `reset()` only re-renders what the client already has), shows the stack in
 * development and the digest otherwise.
 */
export function routeError(options: RouteErrorOptions = {}) {
  return function RouteError({ error, reset }: RouteErrorProps) {
    const router = useRouter();
    const params = useParams<{ id?: string }>();

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
        back={backLink(options.back, Number(params?.id))}
        renderLink={renderLink}
        details={details}
        reference={error.digest}
        fullScreen={options.fullScreen}
      />
    );
  };
}
