import type React from "react";
import {
  Cloud,
  FileCode,
  Folder,
  GitBranch,
  Globe,
  Key,
  LayoutDashboard,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { defaultSenloPaths, type SenloPaths } from "./paths";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  /** Whether the item is the current page; defaults to a prefix match on `href`. */
  isActive?: (pathname: string) => boolean;
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.isActive ? item.isActive(pathname) : pathname.startsWith(item.href);
}

/** A workspace's home page at self-hosted's URLs; `paths.dashboard` in a host-aware screen. */
export const workspaceHomePath = (workspaceId: number) => defaultSenloPaths.dashboard(workspaceId);

/** The workspace id in a self-hosted `/workspace/:id/...` path; `paths.workspaceIdFrom` in a host-aware screen. */
export const workspaceIdFromPath = (pathname: string) => defaultSenloPaths.workspaceIdFrom(pathname);

/** At self-hosted's URLs; `paths.hidesSidebar` in a host-aware screen. */
export const isSidebarHidden = (pathname: string) => defaultSenloPaths.hidesSidebar(pathname);

/** The items of a workspace's own section. */
export function workspaceNavItems(workspaceId: number, paths: SenloPaths = defaultSenloPaths): NavItem[] {
  const dashboard = paths.dashboard(workspaceId);
  const settings = paths.settings(workspaceId);
  const apiKeys = paths.apiKeys(workspaceId);
  return [
    {
      href: dashboard,
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: (pathname) => pathname === dashboard,
    },
    { href: paths.templates(workspaceId), label: "Templates", icon: Folder },
    { href: paths.triggers(workspaceId), label: "Triggers", icon: Zap },
    { href: paths.automations(workspaceId), label: "Automations", icon: GitBranch },
    { href: paths.audience(workspaceId), label: "Audience", icon: Users },
    {
      href: settings,
      label: "Settings",
      icon: Settings,
      isActive: (pathname) => pathname.startsWith(settings),
    },
    { href: apiKeys, label: "API Keys", icon: Key },
  ];
}

/** "Global" inside a workspace: all workspaces, providers, API docs. */
export function globalNavItemsFor(paths: SenloPaths): NavItem[] {
  const workspaces = paths.workspaces();
  return [
    { href: workspaces, label: "All Workspaces", icon: Globe, isActive: (p) => p === workspaces },
    { href: paths.providers(), label: "Providers", icon: Cloud },
    { href: paths.apiDocs(), label: "API Docs", icon: FileCode },
  ];
}

/** Outside a workspace. */
export function mainNavItemsFor(paths: SenloPaths): NavItem[] {
  const workspaces = paths.workspaces();
  return [
    { href: workspaces, label: "Workspaces", icon: Folder, isActive: (p) => p === workspaces },
    { href: paths.providers(), label: "Providers", icon: Cloud },
    { href: paths.apiDocs(), label: "API Docs", icon: FileCode },
  ];
}

/** Shown under "Global" inside a workspace, at self-hosted's URLs. */
export const globalNavItems: NavItem[] = globalNavItemsFor(defaultSenloPaths);

/** Shown outside a workspace, at self-hosted's URLs. */
export const mainNavItems: NavItem[] = mainNavItemsFor(defaultSenloPaths);
