"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import {
  Folder,
  Zap,
  ChevronDown,
  Globe,
  Cloud,
  Key,
  FileCode,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { useProjects } from "apps/web/hooks/use-projects";
import { logger } from "apps/web/lib/logger";
import { useWorkspaceStorage } from "apps/web/hooks/use-workspace-storage";

interface NavItemProps {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  exact?: boolean;
  isActive: boolean;
}

function NavItem({ href, icon: Icon, label, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
        isActive
          ? "bg-zinc-100 text-zinc-900 font-medium"
          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { projects, error } = useProjects();
  const { setWorkspaceId } = useWorkspaceStorage();
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  // Log error if occurred during projects loading
  if (error) {
    logger.error("Failed to load workspaces for sidebar", { error });
  }

  // Hide sidebar in editor
  if (pathname.startsWith("/editor")) return null;

  const projectIdFromParams = params.id ? Number(params.id) : null;
  const isWorkspaceMode =
    pathname.startsWith("/workspace/") && projectIdFromParams;
  const workspaceId = isWorkspaceMode ? projectIdFromParams : null;

  const currentWorkspace = Array.isArray(projects)
    ? projects.find((p) => p.id === workspaceId)
    : null;

  const handleSwitchWorkspace = () => {
    setWorkspaceId(null);
    router.push("/workspaces");
  };

  return (
    <aside className="w-64 border-r border-zinc-200 h-screen bg-zinc-50/50 flex flex-col p-4 fixed left-0 top-0">
      {/* Brand / Workspace Switcher */}
      <div className="mb-8">
        {isWorkspaceMode ? (
          <div className="relative">
            <button
              onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
              className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {currentWorkspace?.name?.[0].toUpperCase() || "W"}
                </div>
                <span className="text-sm font-semibold truncate">
                  {currentWorkspace?.name || "Workspace"}
                </span>
              </div>
              <ChevronDown size={14} className="text-zinc-400" />
            </button>

            {isWorkspaceMenuOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 z-50">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Switch Workspace
                </div>
                {projects.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/workspace/${p.id}/dashboard`}
                    onClick={() => setIsWorkspaceMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
                  >
                    <div className="w-4 h-4 bg-zinc-100 rounded flex items-center justify-center text-[8px]">
                      {p.name?.[0].toUpperCase() || "W"}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
                <div className="border-t border-zinc-100 mt-1 pt-1">
                  <button
                    onClick={handleSwitchWorkspace}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-blue-600 hover:bg-zinc-50"
                  >
                    <Globe size={14} />
                    All workspaces
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2">
            <h1 className="text-sm font-bold flex items-center gap-2">
              <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center text-white text-[10px]">
                S
              </div>
              Senlo Email
            </h1>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-1">
        {isWorkspaceMode ? (
          <>
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Workspace
            </div>
            <NavItem
              href={`/workspace/${workspaceId}/dashboard`}
              label="Dashboard"
              icon={LayoutDashboard}
              isActive={pathname === `/workspace/${workspaceId}/dashboard`}
            />
            <NavItem
              href={`/workspace/${workspaceId}/templates`}
              label="Templates"
              icon={Folder}
              isActive={pathname.startsWith(
                `/workspace/${workspaceId}/templates`,
              )}
            />
            <NavItem
              href={`/workspace/${workspaceId}/triggers`}
              label="Triggers"
              icon={Zap}
              isActive={pathname.startsWith(
                `/workspace/${workspaceId}/triggers`,
              )}
            />
            <NavItem
              href={`/workspace/${workspaceId}/audience`}
              label="Audience"
              icon={Users}
              isActive={pathname.startsWith(
                `/workspace/${workspaceId}/audience`,
              )}
            />
            <NavItem
              href={`/workspace/${workspaceId}/settings/keys`}
              label="API Keys"
              icon={Key}
              isActive={pathname.startsWith(
                `/workspace/${workspaceId}/settings/keys`,
              )}
            />

            <div className="mt-6">
              <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Global
              </div>
              <NavItem
                href="/workspaces"
                label="All Workspaces"
                icon={Globe}
                isActive={pathname === "/workspaces"}
              />
              <NavItem
                href="/providers"
                label="Providers"
                icon={Cloud}
                isActive={pathname.startsWith("/providers")}
              />
              <NavItem
                href="/api-docs"
                label="API Docs"
                icon={FileCode}
                isActive={pathname.startsWith("/api-docs")}
              />
            </div>
          </>
        ) : (
          <>
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Main Menu
            </div>
            <NavItem
              href="/workspaces"
              label="Workspaces"
              icon={Folder}
              isActive={pathname === "/workspaces"}
            />
            <NavItem
              href="/providers"
              label="Providers"
              icon={Cloud}
              isActive={pathname.startsWith("/providers")}
            />
            <NavItem
              href="/api-docs"
              label="API Docs"
              icon={FileCode}
              isActive={pathname.startsWith("/api-docs")}
            />
          </>
        )}
      </div>
    </aside>
  );
}
