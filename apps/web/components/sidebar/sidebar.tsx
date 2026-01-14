"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Folder,
  Send,
  Users,
  Settings,
  ChevronDown,
  Globe,
  Home,
  Cloud,
  Key,
  FileCode,
} from "lucide-react";
import { useProjects } from "apps/web/hooks/use-projects";
import { logger } from "apps/web/lib/logger";

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
  const { projects, error } = useProjects();
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  // Log error if occurred during projects loading
  if (error) {
    logger.error("Failed to load projects for sidebar", { error });
  }

  // Hide sidebar in editor
  if (pathname.startsWith("/editor")) return null;

  const projectId = params.id ? Number(params.id) : null;
  const currentProject = Array.isArray(projects)
    ? projects.find((p) => p.id === projectId)
    : null;

  const isProjectMode = pathname.startsWith("/projects/") && projectId;

  return (
    <aside className="w-64 border-r border-zinc-200 h-screen bg-zinc-50/50 flex flex-col p-4 fixed left-0 top-0">
      {/* Brand / Project Switcher */}
      <div className="mb-8">
        {isProjectMode ? (
          <div className="relative">
            <button
              onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
              className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {currentProject?.name?.[0].toUpperCase() || "P"}
                </div>
                <span className="text-sm font-semibold truncate">
                  {currentProject?.name}
                </span>
              </div>
              <ChevronDown size={14} className="text-zinc-400" />
            </button>

            {isProjectMenuOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 z-50">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Switch Project
                </div>
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    onClick={() => setIsProjectMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
                  >
                    <div className="w-4 h-4 bg-zinc-100 rounded flex items-center justify-center text-[8px]">
                      {p.name?.[0].toUpperCase() || "P"}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
                <div className="border-t border-zinc-100 mt-1 pt-1">
                  <Link
                    href="/projects"
                    onClick={() => setIsProjectMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-zinc-50"
                  >
                    <Globe size={14} />
                    View all projects
                  </Link>
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
        {isProjectMode ? (
          <>
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Project Menu
            </div>
            <NavItem
              href={`/projects/${projectId}`}
              label="Overview"
              icon={Home}
              exact
              isActive={pathname === `/projects/${projectId}`}
            />
            <NavItem
              href={`/projects/${projectId}/campaigns`}
              label="Campaigns"
              icon={Send}
              isActive={pathname.startsWith(`/projects/${projectId}/campaigns`)}
            />
            <NavItem
              href={`/audience?projectId=${projectId}`}
              label="Audience"
              icon={Users}
              isActive={pathname.startsWith("/audience")}
            />

            <div className="mt-6">
              <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Global
              </div>
              <NavItem
                href="/projects"
                label="All Projects"
                icon={Globe}
                exact
                isActive={pathname === "/projects"}
              />
            </div>
          </>
        ) : (
          <>
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Main Menu
            </div>
            <NavItem
              href="/projects"
              label="Projects"
              icon={Folder}
              isActive={pathname.startsWith("/projects")}
            />
            <NavItem
              href="/campaigns"
              label="Campaigns"
              icon={Send}
              isActive={pathname.startsWith("/campaigns")}
            />
            <NavItem
              href="/audience"
              label="Audience"
              icon={Users}
              isActive={pathname.startsWith("/audience")}
            />
            <NavItem
              href="/providers"
              label="Providers"
              icon={Cloud}
              isActive={pathname.startsWith("/providers")}
            />
          </>
        )}
      </div>

      <div className="mt-auto border-t border-zinc-100 pt-4 flex flex-col gap-1">
        <NavItem
          href="/api-docs"
          label="API Docs"
          icon={FileCode}
          isActive={pathname.startsWith("/api-docs")}
        />
        <NavItem
          href="/settings/keys"
          label="API Keys"
          icon={Key}
          isActive={pathname.startsWith("/settings/keys")}
        />
        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings}
          isActive={pathname.startsWith("/settings")}
        />
      </div>
    </aside>
  );
}
