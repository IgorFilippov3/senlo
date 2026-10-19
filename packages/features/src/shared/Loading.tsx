import React from "react";
import { Loader2 } from "lucide-react";

export function Spinner({ size = 32, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-zinc-400 ${className}`} aria-hidden />;
}

/** A spinner with an optional line under it, centered in the space it is given. */
export function LoadingState({
  label,
  className = "py-12",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <Spinner />
      {label ? <p className="text-zinc-500">{label}</p> : <span className="sr-only">Loading</span>}
    </div>
  );
}

/** `LoadingState` filling the viewport, for pages outside the app shell. */
export function LoadingScreen({ label }: { label?: string }) {
  return <LoadingState label={label} className="min-h-screen bg-zinc-50" />;
}
