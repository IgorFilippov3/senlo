"use client";
import { routeError } from "@senlo/next/client";
export default routeError({
  description: "We could not process your unsubscribe request. Please try again.",
  fullScreen: true,
});
