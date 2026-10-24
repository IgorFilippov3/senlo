// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { PageHeader } from "@senlo/ui";
import { useDeleteSuppression, useProjectSuppressions } from "../data/suppressions";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { SuppressionList } from "./SuppressionList";

/** The workspace's suppressed addresses: search, remove after a confirmation. */
export function SuppressionsScreen() {
  const workspace = useCurrentWorkspace();
  const { data: suppressions = [], isLoading } = useProjectSuppressions(workspace.id);
  const remove = useDeleteSuppression();
  const [toDelete, setToDelete] = useState<number | null>(null);

  const closeDelete = () => {
    remove.reset();
    setToDelete(null);
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="Suppression List"
        description="Emails that are blocked from receiving messages due to bounces or spam complaints."
      />

      <div className="mt-8">
        <SuppressionList
          suppressions={suppressions}
          isLoading={isLoading}
          onDelete={setToDelete}
          isDeleting={remove.isPending}
        />
      </div>

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={closeDelete}
        title="Remove from suppression list"
        description="Are you sure you want to remove this email from the suppression list? This will allow future emails to be sent to this address."
        confirmLabel="Remove"
        pendingLabel="Removing..."
        isPending={remove.isPending}
        error={remove.error ? "Failed to remove the address. Please try again." : null}
        onConfirm={() => toDelete !== null && remove.mutate(toDelete, { onSuccess: closeDelete })}
      />
    </div>
  );
}
