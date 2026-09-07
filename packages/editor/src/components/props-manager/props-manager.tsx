"use client";

import React, { memo } from "react";
import styles from "./props-manager.module.css";
import { useEditorStore } from "../../state/editor.store";
import { useShallow } from "zustand/react/shallow";
import { UnknownSection } from "./components/sections/unknown-section";
import { getEditorBlockDefinition } from "../../blocks/registry";
import { GlobalSection } from "./components/sections/global-section";
import { RowSection } from "./components/sections/row-section";

export const PropsManager = () => {
  // Selection info (kind, id, type) is enough to decide which section to show.
  // We use useShallow to only re-render if these basic properties change.
  const selectionInfo = useEditorStore(
    useShallow((s) => {
      const selection = s.selection;
      if (!selection) return null;

      if (selection.kind === "row") {
        const row = s.design.rows.find((r) => r.id === selection.id);
        return row ? { kind: selection.kind, id: selection.id, type: "row" } : null;
      }

      if (selection.kind === "block") {
        // The selection knows its row and column, so this is two lookups by id
        // rather than a walk over every block in the document.
        const row = s.design.rows.find((r) => r.id === selection.rowId);
        const column = row?.columns.find((c) => c.id === selection.columnId);
        const block = column?.blocks.find((b) => b.id === selection.id);

        if (block) return { kind: selection.kind, id: selection.id, type: block.type };
      }

      return null;
    }),
  );

  if (!selectionInfo) {
    return (
      <aside className={styles.panel}>
        <div className={styles.content}>
          <GlobalSection />
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.content}>
        <SectionRenderer 
          kind={selectionInfo.kind as any} 
          id={selectionInfo.id} 
          type={selectionInfo.type} 
        />
      </div>
    </aside>
  );
};

interface SectionRendererProps {
  kind: "row" | "block" | "column";
  id: string;
  type: string;
}

const SectionRenderer = memo(({ kind, id, type }: SectionRendererProps) => {
  // This component fetches the actual block/row data.
  // Since it's memoized, it only re-renders if kind, id or type changes.
  const element = useEditorStore((s) => {
    if (kind === "row") {
      return s.design.rows.find((r) => r.id === id) || null;
    }
    if (kind === "block") {
      const selection = s.selection;
      if (selection?.kind !== "block") return null;

      const row = s.design.rows.find((r) => r.id === selection.rowId);
      const column = row?.columns.find((c) => c.id === selection.columnId);
      return column?.blocks.find((b) => b.id === id) ?? null;
    }
    return null;
  });

  if (!element) return null;

  if (kind === "row") {
    return <RowSection row={element as any} />;
  }

  const block = element as any;
  const definition = getEditorBlockDefinition(type as any);

  if (!definition) return <UnknownSection />;

  const { PropsSection } = definition;
  return <PropsSection block={block} />;
});
