import Link from "next/link";
import type { RenderAuthLink } from "@senlo/features";

export const renderAuthLink: RenderAuthLink = (href, children, className) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);
