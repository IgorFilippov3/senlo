"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

/** A server message under a form, in place of an alert(). Renders nothing without one. */
export function FormErrorBanner({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  );
}
