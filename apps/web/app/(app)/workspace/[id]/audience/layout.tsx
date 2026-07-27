"use client";

import { ReactNode } from "react";

interface AudienceLayoutProps {
  children: ReactNode;
}

export default function AudienceLayout({ children }: AudienceLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">{children}</div>
    </div>
  );
}
