"use client";

import styles from "./row-view-menu.module.css";
import { Trash2, Copy, ArrowUp, ArrowDown, Save, Loader2 } from "lucide-react";
import { useEditorStore } from "../../../../state/editor.store";
import type { RowId } from "@senlo/core";
import { useState } from "react";
import { Dialog, Button, FormField, Input } from "@senlo/ui";

interface RowViewMenuProps {
  rowId: RowId;
}

export const RowViewMenu = ({ rowId }: RowViewMenuProps) => {
  const removeRow = useEditorStore((s) => s.removeRow);
  const duplicateRow = useEditorStore((s) => s.duplicateRow);
  const moveRow = useEditorStore((s) => s.moveRow);
  const saveRowToLibrary = useEditorStore((s) => s.saveRowToLibrary);
  const rows = useEditorStore((s) => s.design.rows);

  const [isSaveDialogOpen, setIsSaveDialogVisible] = useState(false);
  const [rowName, setRowName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const rowIndex = rows.findIndex((r) => r.id === rowId);
  const isFirst = rowIndex === 0;
  const isLast = rowIndex === rows.length - 1;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeRow(rowId);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateRow(rowId);
  };

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFirst) moveRow(rowId, "up");
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLast) moveRow(rowId, "down");
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRowName(`Row ${rowIndex + 1}`);
    setIsSaveDialogVisible(true);
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rowName.trim()) return;

    setIsSaving(true);
    try {
      const success = await saveRowToLibrary(rowName, rowId);
      if (success) {
        setIsSaveDialogVisible(false);
      } else {
        alert("Failed to save row to library");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className={styles.menu}>
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          title="Delete row"
        >
          <Trash2 size={22} />
        </button>
        <button
          className={styles.actionButton}
          onClick={handleDuplicate}
          title="Duplicate row"
        >
          <Copy size={22} />
        </button>
        <button
          className={styles.actionButton}
          onClick={handleSaveClick}
          title="Save to library"
        >
          <Save size={22} />
        </button>
        {!isLast && (
          <button
            className={styles.actionButton}
            onClick={handleMoveDown}
            title="Move down"
          >
            <ArrowDown size={22} />
          </button>
        )}
        {!isFirst && (
          <button
            className={styles.actionButton}
            onClick={handleMoveUp}
            title="Move up"
          >
            <ArrowUp size={22} />
          </button>
        )}
      </div>

      <Dialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogVisible(false)}
        title="Save Row to Library"
        description="Saved rows can be reused in other templates."
      >
        <form onSubmit={handleConfirmSave} className="space-y-4">
          <FormField label="Row Name" required>
            <Input
              value={rowName}
              onChange={(e) => setRowName(e.target.value)}
              placeholder="e.g. Footer with Socials"
              required
              autoFocus
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsSaveDialogVisible(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !rowName.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Saving...
                </>
              ) : (
                "Save Row"
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
