"use client";
import { routeError } from "apps/web/components/route-states";
// `[id]` here is the template, not a workspace: only the workspace list is a safe way back.
export default routeError({
  title: "Editor failed to load",
  description: "The template may have been deleted, or you may not have access to it.",
  back: "workspaces",
  fullScreen: true,
});
