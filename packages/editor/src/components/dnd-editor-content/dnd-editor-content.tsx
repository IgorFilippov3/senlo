"use client";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { useState } from "react";
import { Sidebar } from "../sidebar/sidebar";
import { EmailCanvas } from "../email-canvas/email-canvas";
import { EditorHeader } from "../editor-header/editor-header";
import { PropsManager } from "../props-manager/props-manager";
import { useEditorStore } from "../../state/editor.store";
import { LayoutPreset } from "../../types/layout-preset";
import { ContentBlockType } from "@senlo/core";
import { DragOverlayItem } from "./drag-overlay-item";
import { useKeyboardShortcuts } from "../../hooks/use-keyboard-shortcuts";
import { useUnsavedChanges } from "../../hooks/use-unsaved-changes";

interface DndEditorContentProps {
  projectId: number;
}

export const DndEditorContent = ({ projectId }: DndEditorContentProps) => {
  useKeyboardShortcuts();
  useUnsavedChanges();

  const handleDragEnd = useEditorStore((s) => s.handleDragEnd);
  const setDragActive = useEditorStore((s) => s.setDragActive);
  const setHoveredRowId = useEditorStore((s) => s.setHoveredRowId);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<{
    type: string;
    data: LayoutPreset | ContentBlockType | any;
    label: string;
    originalWidth: number;
  } | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setShowOverlay(true);

    const data = event.active.data.current as {
      type: string;
      data: any;
      label?: string;
    };

    if (
      data.type === "row" ||
      data.type === "block" ||
      data.type === "content" ||
      data.type === "saved-row"
    ) {
      clearSelection();
      setDragActive(true, data.type as any);
    }

    const initialRect = event.active.rect.current.initial;
    let originalWidth = initialRect?.width || 0;

    if (originalWidth === 0) {
      const element = document.querySelector(
        `[data-rbd-draggable-id="${event.active.id}"]`,
      ) as HTMLElement;

      if (!element) {
        const sidebar = document.querySelector(".senlo-editor-sidebar");
        if (sidebar) {
          const buttons = sidebar.querySelectorAll("button");
          buttons.forEach((btn) => {
            if (
              btn.getAttribute("aria-describedby")?.includes("DndDescribedBy")
            ) {
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && originalWidth === 0) {
                originalWidth = rect.width;
              }
            }
          });
        }
      } else {
        originalWidth = element.getBoundingClientRect().width;
      }
    }

    let label = data.label;
    if (!label) {
      if (data.type === "saved-row") {
        label = data.data.name;
      } else {
        label = String(data.data);
      }
    }

    setActiveData({
      type: data.type,
      data: data.data,
      label: label || "",
      originalWidth: originalWidth > 0 ? originalWidth * 0.8 : 200,
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    setShowOverlay(false);
    setDragActive(false);
    setHoveredRowId(null);

    setTimeout(() => {
      setActiveId(null);
      setActiveData(null);
    }, 0);
    handleDragEnd(event);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="senlo-editor-container">
        <EditorHeader projectId={projectId} />
        <div className="senlo-editor-root">
          <aside className="senlo-editor-sidebar">
            <Sidebar />
          </aside>
          <main className="senlo-editor-canvas">
            <EmailCanvas />
          </main>
          <aside className="senlo-editor-inspector">
            <PropsManager />
          </aside>
        </div>
      </div>
      {showOverlay && activeId && activeData && (
        <DragOverlay
          style={{
            transition: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              right:
                activeData.type === "block" || activeData.type === "content"
                  ? "50%"
                  : 0,
              bottom:
                activeData.type === "block" || activeData.type === "content"
                  ? "50%"
                  : 0,
              transform:
                activeData.type === "block" || activeData.type === "content"
                  ? "translate(50%, 50%)"
                  : "none",
            }}
          >
            <DragOverlayItem
              preset={
                activeData.type === "row"
                  ? (activeData.data as LayoutPreset)
                  : undefined
              }
              blockType={
                activeData.type === "content"
                  ? (activeData.data as ContentBlockType)
                  : activeData.type === "block"
                    ? activeData.data.blockType
                    : undefined
              }
              label={activeData.label}
              width={activeData.originalWidth}
              isBlock={activeData.type === "block"}
              isSavedRow={activeData.type === "saved-row"}
            />
          </div>
        </DragOverlay>
      )}
    </DndContext>
  );
};
