"use client";

import "./globals.css";
import "@senlo/ui/styles.css";
import { routeError } from "apps/web/components/route-states";

const RootError = routeError({ fullScreen: true });

/** An error in the root layout itself: replaces it, so it brings its own html, body and styles. */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <RootError {...props} />
      </body>
    </html>
  );
}
