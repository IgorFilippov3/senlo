"use client";

import Link from "next/link";
import { ErrorBoundary } from "apps/web/components/error-boundary";

export default function CampaignsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundary
      fallback={
        <main className="max-w-7xl mx-auto py-10 px-8">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                !
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Failed to load campaigns
              </h1>
              <p className="text-gray-600">
                We could not load your email campaigns. Please try again.
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <Link
                href="/workspaces"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Back to Workspaces
              </Link>
            </div>
          </div>
        </main>
      }
    >
      {null}
    </ErrorBoundary>
  );
}
