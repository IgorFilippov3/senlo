import React from "react";
import { AlertTriangle, FileQuestion, RefreshCw } from "lucide-react";
import { Button } from "@senlo/ui";
import type { RenderLink } from "../layout/Sidebar";

export interface ErrorScreenProps {
  title?: string;
  description?: string;
  /** Shows "Try again". */
  onRetry?: () => void;
  /** A second way out, e.g. back to the list the page belongs to. */
  back?: { href: string; label: string };
  /** Renders `back`; a plain `<a>` without it. */
  renderLink?: RenderLink;
  /** Technical text under a "Details" toggle. The app decides when it is safe to show. */
  details?: string;
  /** A short id to quote when reporting the problem (Next.js error digest). */
  reference?: string;
  /** Fill the viewport instead of the page area (pages without the app shell). */
  fullScreen?: boolean;
}

const backClassName =
  "inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors";

function BackLink({ back, renderLink }: { back: { href: string; label: string }; renderLink?: RenderLink }) {
  return renderLink ? (
    <>{renderLink(back.href, back.label, backClassName)}</>
  ) : (
    <a href={back.href} className={backClassName}>
      {back.label}
    </a>
  );
}

function ScreenFrame({ fullScreen, children }: { fullScreen: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        fullScreen
          ? "min-h-screen bg-zinc-50 flex items-center justify-center p-8"
          : "flex items-center justify-center py-20 px-8"
      }
    >
      <div className="max-w-md w-full text-center space-y-6">{children}</div>
    </div>
  );
}

/** The one "this page failed" screen: route error boundaries and failed page loads. */
export function ErrorScreen({
  title = "Something went wrong",
  description = "We could not load this page. Please try again.",
  onRetry,
  back,
  renderLink,
  details,
  reference,
  fullScreen = false,
}: ErrorScreenProps) {
  return (
    <ScreenFrame fullScreen={fullScreen}>
      <div role="alert" className="space-y-6">
        <div className="mx-auto w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          <p className="text-zinc-600">{description}</p>
          {reference && <p className="text-xs text-zinc-400">Reference: {reference}</p>}
        </div>

        {(onRetry || back) && (
          <div className="flex justify-center gap-3">
            {onRetry && (
              <Button onClick={onRetry}>
                <RefreshCw size={16} />
                Try again
              </Button>
            )}
            {back && <BackLink back={back} renderLink={renderLink} />}
          </div>
        )}

        {details && (
          <details className="text-left">
            <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700">
              Details
            </summary>
            <pre className="mt-2 p-4 bg-zinc-50 rounded text-xs text-zinc-800 overflow-auto max-h-60 whitespace-pre-wrap">
              {details}
            </pre>
          </details>
        )}
      </div>
    </ScreenFrame>
  );
}

export interface NotFoundScreenProps {
  title?: string;
  description?: string;
  back?: { href: string; label: string };
  renderLink?: RenderLink;
  fullScreen?: boolean;
}

/** "This page does not exist": a `notFound()` or an unknown URL. */
export function NotFoundScreen({
  title = "Page not found",
  description = "The page you are looking for does not exist, or you do not have access to it.",
  back,
  renderLink,
  fullScreen = false,
}: NotFoundScreenProps) {
  return (
    <ScreenFrame fullScreen={fullScreen}>
      <div className="mx-auto w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center">
        <FileQuestion size={28} className="text-zinc-500" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-zinc-400">404</p>
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        <p className="text-zinc-600">{description}</p>
      </div>
      {back && (
        <div className="flex justify-center">
          <BackLink back={back} renderLink={renderLink} />
        </div>
      )}
    </ScreenFrame>
  );
}
