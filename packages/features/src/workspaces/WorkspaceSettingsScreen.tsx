// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { PageHeader } from "@senlo/ui";
import { useAiProviders, useProviders } from "../data/providers";
import { useUpdateProject } from "../data/workspaces";
import { useSenloDialogs } from "../dialogs/registry";
import { useSenloNavigation } from "../layout/navigation-context";
import { useCurrentWorkspace } from "./WorkspaceScope";
import { WorkspaceSettings } from "./WorkspaceSettings";

/** The workspace's general settings page: name, description, providers, delete. */
export function WorkspaceSettingsScreen() {
  const workspace = useCurrentWorkspace();
  const { paths, renderLink } = useSenloNavigation();
  const { data: providers = [], isLoading: providersLoading } = useProviders();
  const { data: aiProviders = [], isLoading: aiProvidersLoading } = useAiProviders();
  const update = useUpdateProject();
  const { open: openDialog } = useSenloDialogs();

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader title="General Settings" description="Manage your workspace details and configuration." />
      <div className="mt-8">
        {providersLoading || aiProvidersLoading ? (
          <div className="animate-pulse space-y-8">
            <div className="h-64 bg-zinc-100 rounded-xl w-full" />
            <div className="h-32 bg-zinc-100 rounded-xl w-full" />
          </div>
        ) : (
          <WorkspaceSettings
            // A saved change resets the form to the stored values.
            key={workspace.updatedAt.toString()}
            workspace={workspace}
            emailProviders={providers}
            aiProviders={aiProviders}
            renderProvidersLink={(children) =>
              renderLink(paths.providers(), children, "underline font-medium")
            }
            onSave={(values) => update.mutate({ projectId: workspace.id, values })}
            onDelete={() => openDialog("DELETE_WORKSPACE", { project: workspace })}
            isSaving={update.isPending}
            error={update.error?.message}
          />
        )}
      </div>
    </main>
  );
}
