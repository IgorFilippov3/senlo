"use client";

import styles from "./rows-section.module.css";
import { useEditorStore } from "../../../../state/editor.store";
import { PaletteItem } from "../palette-item/palette-item";
import { SidebarSection } from "../sidebar-section/sidebar-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { Loader2 } from "lucide-react";
import { SavedRowCard } from "./saved-row-card";

export const RowsSection = () => {
  const mode = useEditorStore((s) => s.rowsSidebarMode);
  const setMode = useEditorStore((s) => s.setRowsSidebarMode);
  const savedRows = useEditorStore((s) => s.savedRows);
  const isLoading = useEditorStore((s) => s.isLoadingSavedRows);
  const deleteRow = useEditorStore((s) => s.deleteSavedRow);
  const addSavedRowToDesign = useEditorStore((s) => s.addSavedRowToDesign);

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
            <PaletteItem preset="1col" />
            <PaletteItem preset="2col-25-75" />
            <PaletteItem preset="2col-75-25" />
            <PaletteItem preset="2col-50-50" />
            <PaletteItem preset="2col-33-67" />
            <PaletteItem preset="2col-67-33" />
            <PaletteItem preset="3col" />
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
                  onDelete={(id) => {
                    if (
                      confirm("Are you sure you want to delete this saved row?")
                    ) {
                      deleteRow(id);
                    }
                  }}
                  onClick={() => addSavedRowToDesign(row)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
