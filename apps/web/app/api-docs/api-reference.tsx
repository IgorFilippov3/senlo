"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { openApiSpec } from "apps/web/lib/openapi";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ApiReferenceProps {
  backHref: string;
  backLabel: string;
}

export function ApiReference({ backHref, backLabel }: ApiReferenceProps) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      {/* Top Bar to get back */}
      <div className="flex items-center px-4 py-3 border-b border-zinc-200 bg-white sticky top-0 z-50">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors font-medium"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Link>
      </div>

      <div className="flex-1">
        <ApiReferenceReact
          configuration={{
            content: openApiSpec,
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
