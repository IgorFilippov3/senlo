"use client";
import { routeError } from "@senlo/next/client";
export default routeError({
  title: "Failed to load trigger",
  description: "It may have been deleted, or you may not have access to it.",
  back: "triggers",
});
