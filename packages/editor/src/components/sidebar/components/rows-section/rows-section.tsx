"use client";

import styles from "./rows-section.module.css";
import { useEditorStore } from "../../../../state/editor.store";
import { PaletteItem } from "../palette-item/palette-item";
import { SidebarSection } from "../sidebar-section/sidebar-section";
import { useState } from "react";
import type { SavedRow } from "@senlo/core";
import {
  Button,
  Dialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { Loader2 } from "lucide-react";
import { SavedRowCard } from "./saved-row-card";
import { LAYOUT_PRESET_ORDER } from "../../../../state/columns/presets";

export const RowsSection = () => {
  const mode = useEditorStore((s) => s.rowsSidebarMode);
  const setMode = useEditorStore((s) => s.setRowsSidebarMode);
  const savedRows = useEditorStore((s) => s.savedRows);
  const isLoading = useEditorStore((s) => s.isLoadingSavedRows);
  const deleteRow = useEditorStore((s) => s.deleteSavedRow);
  const addSavedRowToDesign = useEditorStore((s) => s.addSavedRowToDesign);

  // Asked in a dialog, not with `confirm()`; a failed delete says so there.
  const [toDelete, setToDelete] = useState<SavedRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const closeDelete = () => {
    setToDelete(null);
    setDeleteFailed(false);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    setDeleteFailed(false);
    try {
      if (await deleteRow(toDelete.id)) closeDelete();
      else setDeleteFailed(true);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Select
          value={mode}
          onValueChange={(val) => setMode(val as "empty" | "saved")}
        >
          <SelectTrigger className={styles.selectTrigger}>
            <SelectValue placeholder="Select rows type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="empty">Empty Rows</SelectItem>
            <SelectItem value="saved">Saved Rows</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={styles.content}>
        {mode === "empty" ? (
          <SidebarSection title="Standard Layouts" variant="rows">
            {LAYOUT_PRESET_ORDER.map((preset) => (
              <PaletteItem key={preset} preset={preset} />
            ))}
          </SidebarSection>
        ) : (
          <div className={styles.savedRowsList}>
            {isLoading ? (
              <div className={styles.loading}>
                <Loader2 className="animate-spin h-5 w-5 mx-auto" />
              </div>
            ) : savedRows.length === 0 ? (
              <div className={styles.emptyState}>
                No saved rows yet. Save rows from the canvas to see them here.
              </div>
            ) : (
              savedRows.map((row) => (
                <SavedRowCard
                  key={row.id}
                  row={row}
                  onDelete={() => setToDelete(row)}
                  onClick={() => addSavedRowToDesign(row)}
                />
              ))
            )}
          </div>
        )}
      </div>

      <Dialog
        isOpen={toDelete !== null}
        onClose={closeDelete}
        disableAnimation={true}
        title="Delete saved row"
        description={`Are you sure you want to delete "${toDelete?.name ?? ""}"? Templates that already use it keep their copy.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeDelete} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Row"}
            </Button>
          </div>
        }
      >
        {deleteFailed && (
          <p className="text-sm text-red-600" role="alert">
            Failed to delete the saved row. Please try again.
          </p>
        )}
      </Dialog>
    </div>
  );
};
