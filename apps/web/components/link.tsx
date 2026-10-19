import Link from "next/link";
import type { RenderLink } from "@senlo/features";

/** How features components render a link in this app: through Next.js `Link`. */
export const renderLink: RenderLink = (href, children, className) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);
