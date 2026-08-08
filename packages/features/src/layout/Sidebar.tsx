"use client";

import React from "react";
import { ChevronDown, Globe } from "lucide-react";
import type { Project } from "@senlo/core";

export interface NavItem {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  isActive: boolean;
}

export interface SidebarProps {
  // Brand
  brandName: string;
  brandIcon: React.ReactNode;

  // Workspace Switcher
  isWorkspaceMode: boolean;
  currentWorkspace?: Project;
  workspaces: Project[];
  onSwitchWorkspace: (id: number | null) => void;
  renderWorkspaceLink: (
    id: number,
    children: React.ReactNode,
  ) => React.ReactNode;

  // Navigation
  workspaceNavItems: NavItem[];
  globalNavItems: NavItem[];
  mainNavItems: NavItem[];

  // Callbacks
  renderLink: (
    href: string,
    children: React.ReactNode,
    className: string,
  ) => React.ReactNode;
}

function NavItemComponent({
  item,
  renderLink,
}: {
  item: NavItem;
  renderLink: SidebarProps["renderLink"];
}) {
  const Icon = item.icon;
  const className = `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
    item.isActive
      ? "bg-zinc-100 text-zinc-900 font-medium"
      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
  }`;

  return renderLink(
    item.href,
    <>
      <Icon size={18} />
      {item.label}
    </>,
    className,
  );
}

export function Sidebar({
  brandName,
  brandIcon,
  isWorkspaceMode,
  currentWorkspace,
  workspaces,
  onSwitchWorkspace,
  renderWorkspaceLink,
  workspaceNavItems,
  globalNavItems,
  mainNavItems,
  renderLink,
}: SidebarProps) {
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = React.useState(false);

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
                {workspaces.slice(0, 5).map((p) => (
                  <div key={p.id} onClick={() => setIsWorkspaceMenuOpen(false)}>
                    {renderWorkspaceLink(
                      p.id,
                      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 cursor-pointer">
                        <div className="w-4 h-4 bg-zinc-100 rounded flex items-center justify-center text-[8px]">
                          {p.name?.[0].toUpperCase() || "W"}
                        </div>
                        <span className="truncate">{p.name}</span>
                      </div>,
                    )}
                  </div>
                ))}
                <div className="border-t border-zinc-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setIsWorkspaceMenuOpen(false);
                      onSwitchWorkspace(null);
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

      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-1">
        {isWorkspaceMode ? (
          <>
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Workspace
            </div>
            {workspaceNavItems.map((item, idx) => (
              <NavItemComponent key={idx} item={item} renderLink={renderLink} />
            ))}

            <div className="mt-6">
              <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Global
              </div>
              {globalNavItems.map((item, idx) => (
                <NavItemComponent
                  key={idx}
                  item={item}
                  renderLink={renderLink}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Main Menu
            </div>
            {mainNavItems.map((item, idx) => (
              <NavItemComponent key={idx} item={item} renderLink={renderLink} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
