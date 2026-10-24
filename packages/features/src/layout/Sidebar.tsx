"use client";

import React from "react";
import { ChevronDown, Globe, LogOut } from "lucide-react";
import type { Project } from "@senlo/core";
import {
  type NavItem,
  globalNavItemsFor,
  isNavItemActive,
  mainNavItemsFor,
  workspaceNavItems,
} from "./navigation";
import { defaultSenloPaths, type SenloPaths } from "./paths";

export type RenderLink = (
  href: string,
  children: React.ReactNode,
  className: string,
) => React.ReactNode;

export interface SidebarProps {
  brandName: string;
  brandIcon: React.ReactNode;
  pathname: string;
  /** The user's workspaces, for the switcher. */
  workspaces: Project[];
  /** "All workspaces" in the switcher; the app forgets the remembered workspace and leaves. */
  onShowAllWorkspaces: () => void;
  renderLink: RenderLink;
  /** Shows "Sign out" at the bottom. */
  onSignOut?: () => void;
  /** The host's URLs; self-hosted's by default. */
  paths?: SenloPaths;
  /** Override the default items, e.g. to add managed-only pages. */
  workspaceItems?: (workspaceId: number) => NavItem[];
  globalItems?: NavItem[];
  mainItems?: NavItem[];
}

function NavSection({
  title,
  items,
  pathname,
  renderLink,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  renderLink: RenderLink;
}) {
  return (
    <div>
      <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const className = `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
          isNavItemActive(item, pathname)
            ? "bg-zinc-100 text-zinc-900 font-medium"
            : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
        }`;
        return (
          <React.Fragment key={item.href}>
            {renderLink(
              item.href,
              <>
                <Icon size={18} />
                {item.label}
              </>,
              className,
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function WorkspaceSwitcher({
  current,
  workspaces,
  onShowAllWorkspaces,
  renderLink,
  paths,
}: {
  current?: Project;
  workspaces: Project[];
  onShowAllWorkspaces: () => void;
  renderLink: RenderLink;
  paths: SenloPaths;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-zinc-100 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {current?.name?.[0]?.toUpperCase() || "W"}
          </div>
          <span className="text-sm font-semibold truncate">{current?.name || "Workspace"}</span>
        </div>
        <ChevronDown size={14} className="text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 z-50">
          <div className="px-2 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Switch Workspace
          </div>
          {workspaces.slice(0, 5).map((p) => (
            <div key={p.id} onClick={() => setIsOpen(false)}>
              {renderLink(
                paths.dashboard(p.id),
                <>
                  <div className="w-4 h-4 bg-zinc-100 rounded flex items-center justify-center text-[8px]">
                    {p.name?.[0]?.toUpperCase() || "W"}
                  </div>
                  <span className="truncate">{p.name}</span>
                </>,
                "flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 cursor-pointer",
              )}
            </div>
          ))}
          <div className="border-t border-zinc-100 mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onShowAllWorkspaces();
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-blue-600 hover:bg-zinc-50"
            >
              <Globe size={14} />
              All workspaces
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  brandName,
  brandIcon,
  pathname,
  workspaces,
  onShowAllWorkspaces,
  renderLink,
  onSignOut,
  paths = defaultSenloPaths,
  workspaceItems = (id) => workspaceNavItems(id, paths),
  globalItems = globalNavItemsFor(paths),
  mainItems = mainNavItemsFor(paths),
}: SidebarProps) {
  const workspaceId = paths.workspaceIdFrom(pathname);

  return (
    <aside className="w-64 border-r border-zinc-200 h-screen bg-zinc-50/50 flex flex-col p-4 fixed left-0 top-0">
      <div className="mb-8">
        {workspaceId !== null ? (
          <WorkspaceSwitcher
            current={workspaces.find((p) => p.id === workspaceId)}
            workspaces={workspaces}
            onShowAllWorkspaces={onShowAllWorkspaces}
            renderLink={renderLink}
            paths={paths}
          />
        ) : (
          <div className="p-2">
            <h1 className="text-sm font-bold flex items-center gap-2">
              <div className="w-6 h-6 bg-zinc-900 rounded flex items-center justify-center text-white text-[10px]">
                {brandIcon}
              </div>
              {brandName}
            </h1>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-1">
        {workspaceId !== null ? (
          <>
            <NavSection
              title="Workspace"
              items={workspaceItems(workspaceId)}
              pathname={pathname}
              renderLink={renderLink}
            />
            <div className="mt-6">
              <NavSection title="Global" items={globalItems} pathname={pathname} renderLink={renderLink} />
            </div>
          </>
        ) : (
          <NavSection title="Main Menu" items={mainItems} pathname={pathname} renderLink={renderLink} />
        )}
      </div>

      {onSignOut && (
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      )}
    </aside>
  );
}
