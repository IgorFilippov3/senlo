import Link from "next/link";
import type React from "react";

export const renderProvidersLink = (children: React.ReactNode) => (
  <Link href="/providers" className="underline font-medium">
    {children}
  </Link>
);
