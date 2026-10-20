"use client";

import React from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { ArrowLeft } from "lucide-react";
import type { RenderLink } from "../layout/Sidebar";

export interface ApiDocsViewProps {
  /** The OpenAPI document (`openApiSpec` from `@senlo/core/server`), passed in by the server page. */
  spec: Record<string, unknown>;
  back: { href: string; label: string };
  renderLink: RenderLink;
}

/**
 * The public API reference. Lives under `@senlo/features/api-docs`, not the
 * root entry: the Scalar renderer is large and only this page needs it.
 */
export function ApiDocsView({ spec, back, renderLink }: ApiDocsViewProps) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <div className="flex items-center px-4 py-3 border-b border-zinc-200 bg-white sticky top-0 z-50">
        {renderLink(
          back.href,
          <>
            <ArrowLeft size={16} />
            {back.label}
          </>,
          "flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors font-medium",
        )}
      </div>

      <div className="flex-1">
        <ApiReferenceReact
          configuration={{
            content: spec,
            theme: "default",
            layout: "modern",
            showSidebar: true,
            hideDownloadButton: true,
          }}
        />
      </div>
    </div>
  );
}
