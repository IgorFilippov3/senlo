"use client";

import React from "react";
import type { WorkflowStatus } from "@senlo/core";
import { Button, Badge } from "@senlo/ui";
import { Save, Play, Pause, ChevronLeft, AlertCircle } from "lucide-react";
import { GoLiveErrorsDialog } from "./WorkflowDialogs";

export interface WorkflowEditorShellProps {
  name: string;
  status: WorkflowStatus;
  onBack: () => void;
  onSave: () => void;
  isSaving?: boolean;
  /** Go live when not active, pause when active. */
  onToggleStatus: () => void;
  isChangingStatus?: boolean;
  /** Why the last save or status change failed, shown under the header. */
  error?: string | null;
  /** Reasons from the last refused go-live; the dialog shows while set. */
  goLiveErrors: string[] | null;
  onDismissGoLiveErrors: () => void;
  /** The builder canvas. */
  children: React.ReactNode;
}

/** Header (back, name, status, Go Live / Pause, Save) around the automation builder. */
export function WorkflowEditorShell({
  name,
  status,
  onBack,
  onSave,
  isSaving = false,
  onToggleStatus,
  isChangingStatus = false,
  error,
  goLiveErrors,
  onDismissGoLiveErrors,
  children,
}: WorkflowEditorShellProps) {
  const isActive = status === "ACTIVE";

  return (
    <div className="h-screen w-full overflow-hidden">
      <div className="flex flex-col h-full w-full relative bg-gray-50 p-6">
        <div className="h-16 border border-gray-200 bg-white flex items-center justify-between px-6 z-10 shadow-sm rounded-xl mb-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="hover:bg-gray-100" onClick={onBack}>
              <ChevronLeft size={20} className="text-gray-500" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-gray-900 text-base leading-none">{name}</h1>
                <Badge
                  variant={isActive ? "success" : "secondary"}
                  className="h-4 text-[9px] px-1.5 uppercase font-bold"
                >
                  {status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Automation Builder
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {error && (
              <span className="flex items-center gap-1.5 text-xs text-red-600 max-w-xs truncate" title={error}>
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </span>
            )}
            <Button
              variant="outline"
              className="font-semibold text-xs uppercase tracking-wider h-9 border-gray-200"
              onClick={onToggleStatus}
              disabled={isChangingStatus || isSaving}
            >
              {isActive ? (
                <>
                  <Pause size={14} className="mr-2" /> Pause
                </>
              ) : (
                <>
                  <Play size={14} className="mr-2" /> Go Live
                </>
              )}
            </Button>
            <Button
              className="font-semibold text-xs uppercase tracking-wider h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10 min-w-[140px]"
              onClick={onSave}
              disabled={isSaving}
            >
              <Save size={14} className="mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {children}
        </div>

        <GoLiveErrorsDialog reasons={goLiveErrors} onClose={onDismissGoLiveErrors} />
      </div>
    </div>
  );
}
