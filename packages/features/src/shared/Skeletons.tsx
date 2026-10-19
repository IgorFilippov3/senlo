import React from "react";

/** A grey placeholder bar; size and shape come from `className`. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-zinc-200 rounded ${className}`} />;
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="border border-zinc-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="w-16 h-5" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="border border-zinc-200 rounded-lg p-6 flex items-center justify-between gap-6">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-zinc-200 rounded-lg p-6 flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="border border-zinc-200 rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-32 mb-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border border-zinc-100 rounded">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export type PageSkeletonVariant = "cards" | "rows" | "details";

/**
 * Placeholder for a standard page (`max-w-7xl` main with a header): a card grid
 * (templates, providers), a list of rows (API keys, triggers) or a details page
 * (stats + activity). Used both by route `loading.tsx` and by pages still
 * fetching on the client, so the two look the same and nothing jumps.
 */
export function PageSkeleton({ variant = "cards" }: { variant?: PageSkeletonVariant }) {
  return (
    <main role="status" aria-label="Loading" className="max-w-7xl mx-auto py-10 px-8 animate-pulse">
      <HeaderSkeleton />
      {variant === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}
      {variant === "rows" && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      )}
      {variant === "details" && <DetailsSkeleton />}
    </main>
  );
}

/** Placeholder for the full-screen email editor: header, block sidebar, canvas, properties. */
export function EditorSkeleton() {
  return (
    <div role="status" aria-label="Loading editor" className="h-screen bg-zinc-50 flex flex-col animate-pulse">
      <div className="border-b border-zinc-200 bg-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex-1 flex">
        <div className="w-64 border-r border-zinc-200 bg-white p-4 grid grid-cols-2 gap-2 content-start">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <div className="max-w-2xl mx-auto bg-white border border-zinc-200 rounded-lg p-8 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-12 w-32 mx-auto mt-6" />
          </div>
        </div>
        <div className="w-80 border-l border-zinc-200 bg-white p-4 space-y-4">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
