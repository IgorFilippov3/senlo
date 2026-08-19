"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { Settings, Folder, Zap, Globe, Cloud, Key, FileCode, Users, LayoutDashboard, GitBranch } from "lucide-react";
import { useProjects } from "apps/web/hooks/use-projects";
import { useWorkspaceStorage } from "apps/web/hooks/use-workspace-storage";
import { Sidebar as SharedSidebar, NavItem } from "@senlo/features";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { projects } = useProjects();
  const { setWorkspaceId } = useWorkspaceStorage();

  // Hide sidebar in editor
  if (pathname.startsWith("/editor")) return null;

  const projectIdFromParams = params.id ? Number(params.id) : null;
  const isWorkspaceMode = !!(
    pathname.startsWith("/workspace/") && projectIdFromParams
  );
  const workspaceId = isWorkspaceMode ? projectIdFromParams : null;

  const currentWorkspace = Array.isArray(projects)
    ? projects.find((p) => p.id === workspaceId)
    : undefined;

  const handleSwitchWorkspace = (id: number | null) => {
    setWorkspaceId(id);
    if (id === null) {
      router.push("/workspaces");
    } else {
      router.push(`/workspace/${id}/dashboard`);
    }
  };

  const renderLink = (
    href: string,
    children: React.ReactNode,
    className: string,
  ) => (
    <Link href={href} className={className}>
      {children}
    </Link>
  );

  const renderWorkspaceLink = (id: number, children: React.ReactNode) => (
    <Link href={`/workspace/${id}/dashboard`}>{children}</Link>
  );

  const workspaceNavItems: NavItem[] = [
    {
      href: `/workspace/${workspaceId}/dashboard`,
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: pathname === `/workspace/${workspaceId}/dashboard`,
    },
    {
      href: `/workspace/${workspaceId}/templates`,
      label: "Templates",
      icon: Folder,
      isActive: pathname.startsWith(`/workspace/${workspaceId}/templates`),
    },
    {
      href: `/workspace/${workspaceId}/triggers`,
      label: "Triggers",
      icon: Zap,
      isActive: pathname.startsWith(`/workspace/${workspaceId}/triggers`),
    },
    {
      href: `/workspace/${workspaceId}/automations`,
      label: "Automations",
      icon: GitBranch,
      isActive: pathname.startsWith(`/workspace/${workspaceId}/automations`),
    },
    {
      href: `/workspace/${workspaceId}/audience`,
      label: "Audience",
      icon: Users,
      isActive: pathname.startsWith(`/workspace/${workspaceId}/audience`),
    },
    {
      href: `/workspace/${workspaceId}/settings/general`,
      label: "Settings",
      icon: Settings,
      isActive: pathname.startsWith(`/workspace/${workspaceId}/settings`) && !pathname.includes("/keys"),
    },
    {
      href: `/workspace/${workspaceId}/settings/keys`,
      label: "API Keys",
      icon: Key,
      isActive: pathname.startsWith(`/workspace/${workspaceId}/settings/keys`),
    },
  ];

  const globalNavItems: NavItem[] = [
    {
      href: "/workspaces",
      label: "All Workspaces",
      icon: Globe,
      isActive: pathname === "/workspaces",
    },
    {
      href: "/providers",
      label: "Providers",
      icon: Cloud,
      isActive: pathname.startsWith("/providers"),
    },
    {
      href: "/api-docs",
      label: "API Docs",
      icon: FileCode,
      isActive: pathname.startsWith("/api-docs"),
    },
  ];

  const mainNavItems: NavItem[] = [
    {
      href: "/workspaces",
      label: "Workspaces",
      icon: Folder,
      isActive: pathname === "/workspaces",
    },
    {
      href: "/providers",
      label: "Providers",
      icon: Cloud,
      isActive: pathname.startsWith("/providers"),
    },
    {
      href: "/api-docs",
      label: "API Docs",
      icon: FileCode,
      isActive: pathname.startsWith("/api-docs"),
    },
  ];

  return (
    <SharedSidebar
      brandName="Senlo Email"
      brandIcon="S"
      isWorkspaceMode={isWorkspaceMode}
      currentWorkspace={currentWorkspace}
      workspaces={projects}
      onSwitchWorkspace={handleSwitchWorkspace}
      renderWorkspaceLink={renderWorkspaceLink}
      workspaceNavItems={workspaceNavItems}
      globalNavItems={globalNavItems}
      mainNavItems={mainNavItems}
      renderLink={renderLink}
    />
  );
}
