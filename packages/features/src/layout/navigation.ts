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

export const workspaceHomePath = (workspaceId: number) => `/workspace/${workspaceId}/dashboard`;

/** The workspace id in a `/workspace/:id/...` path, or null outside one. */
export function workspaceIdFromPath(pathname: string): number | null {
  const match = /^\/workspace\/(\d+)(\/|$)/.exec(pathname);
  return match ? Number(match[1]) : null;
}

/**
 * Signed-in pages that render without the sidebar: the editor and the
 * workspace picker. Public pages live outside the app shell altogether.
 */
export function isSidebarHidden(pathname: string): boolean {
  return pathname.startsWith("/editor") || pathname === "/workspaces";
}

export function workspaceNavItems(workspaceId: number): NavItem[] {
  const base = `/workspace/${workspaceId}`;
  return [
    {
      href: `${base}/dashboard`,
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: (pathname) => pathname === `${base}/dashboard`,
    },
    { href: `${base}/templates`, label: "Templates", icon: Folder },
    { href: `${base}/triggers`, label: "Triggers", icon: Zap },
    { href: `${base}/automations`, label: "Automations", icon: GitBranch },
    { href: `${base}/audience`, label: "Audience", icon: Users },
    {
      href: `${base}/settings/general`,
      label: "Settings",
      icon: Settings,
      isActive: (pathname) =>
        pathname.startsWith(`${base}/settings`) && !pathname.startsWith(`${base}/settings/keys`),
    },
    { href: `${base}/settings/keys`, label: "API Keys", icon: Key },
  ];
}

const providersItem: NavItem = { href: "/providers", label: "Providers", icon: Cloud };
const apiDocsItem: NavItem = { href: "/api-docs", label: "API Docs", icon: FileCode };
const isWorkspacesPage = (pathname: string) => pathname === "/workspaces";

/** Shown under "Global" inside a workspace. */
export const globalNavItems: NavItem[] = [
  { href: "/workspaces", label: "All Workspaces", icon: Globe, isActive: isWorkspacesPage },
  providersItem,
  apiDocsItem,
];

/** Shown outside a workspace. */
export const mainNavItems: NavItem[] = [
  { href: "/workspaces", label: "Workspaces", icon: Folder, isActive: isWorkspacesPage },
  providersItem,
  apiDocsItem,
];
