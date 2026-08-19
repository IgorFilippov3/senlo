"use client";

import React, { useState } from "react";
import type { Project, EmailProvider } from "@senlo/core";
import {
  Card,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { Save, Trash2, AlertTriangle } from "lucide-react";

export interface WorkspaceSettingsProps {
  workspace: Project;
  emailProviders?: EmailProvider[];
  onUpdate?: (data: {
    name: string;
    description?: string | null;
    providerId?: number | null;
  }) => void;
  onDelete?: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function WorkspaceSettings({
  workspace,
  emailProviders = [],
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: WorkspaceSettingsProps) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || "");
  const [providerId, setProviderId] = useState<string>(
    workspace.providerId ? String(workspace.providerId) : "none",
  );

  const handleSave = () => {
    if (!name.trim()) return;
    onUpdate?.({
      name: name.trim(),
      description: description.trim() || null,
      providerId: providerId === "none" ? null : Number(providerId),
    });
  };

  const handleDelete = () => {
    if (
      confirm(
        "DANGER: Are you sure you want to delete this workspace? All templates, triggers, and data associated with it will be permanently removed. This action cannot be undone.",
      )
    ) {
      onDelete?.();
    }
  };

  const hasChanges =
    name !== workspace.name ||
    description !== (workspace.description || "") ||
    providerId !==
      (workspace.providerId ? String(workspace.providerId) : "none");

  return (
    <div className="space-y-8">
      <Card className="p-6 border-zinc-200 shadow-sm">
        <h3 className="text-lg font-medium mb-6">General Settings</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="e.g. My Awesome Project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              placeholder="What is this workspace for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Default Email Provider
            </label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Sending disabled)</SelectItem>
                {emailProviders.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-zinc-500">
              This provider will be used for all automations and triggers in
              this workspace.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={!name.trim() || !hasChanges || isUpdating}
              className="gap-2"
            >
              <Save size={16} />
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-red-100 bg-red-50/30 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-100 rounded-lg text-red-600 flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Danger Zone
            </h3>
            <p className="text-sm text-red-700 mb-6">
              Deleting this workspace will permanently remove all associated
              templates, triggers, contacts, and logs. This action is
              irreversible.
            </p>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 size={16} />
              {isDeleting ? "Deleting..." : "Delete Workspace"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
