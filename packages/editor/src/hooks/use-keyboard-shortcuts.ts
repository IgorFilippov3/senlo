import { useEffect } from "react";
import { useEditorStore } from "../state/editor.store";

export type KeyboardShortcutModifier = "⌘" | "Ctrl";

export const KEYBOARD_SHORTCUT_KEYS = {
  undo: "z",
  redo: "z",
  redoAlternative: "y",
  duplicate: "d",
} as const;

export const KEYBOARD_SHORTCUTS = [
  {
    group: "Editing",
    label: "Duplicate the selected row or block",
    mac: `⌘ + ${KEYBOARD_SHORTCUT_KEYS.duplicate.toUpperCase()}`,
    other: `Ctrl + ${KEYBOARD_SHORTCUT_KEYS.duplicate.toUpperCase()}`,
  },
  {
    group: "Editing",
    label: "Delete the selected row or block",
    mac: "Delete or Backspace",
    other: "Delete or Backspace",
  },
  {
    group: "Selection",
    label: "Move the selection",
    mac: "↑ / ↓",
    other: "↑ / ↓",
  },
  {
    group: "Selection",
    label: "Clear the selection",
    mac: "Escape",
    other: "Escape",
  },
  {
    group: "History",
    label: "Undo",
    mac: `⌘ + ${KEYBOARD_SHORTCUT_KEYS.undo.toUpperCase()}`,
    other: `Ctrl + ${KEYBOARD_SHORTCUT_KEYS.undo.toUpperCase()}`,
  },
  {
    group: "History",
    label: "Redo",
    mac: `⌘ + Shift + ${KEYBOARD_SHORTCUT_KEYS.redo.toUpperCase()} or ⌘ + ${KEYBOARD_SHORTCUT_KEYS.redoAlternative.toUpperCase()}`,
    other: `Ctrl + Shift + ${KEYBOARD_SHORTCUT_KEYS.redo.toUpperCase()} or Ctrl + ${KEYBOARD_SHORTCUT_KEYS.redoAlternative.toUpperCase()}`,
  },
] as const;

export function getKeyboardShortcutModifier(platform?: string): KeyboardShortcutModifier {
  const value = platform ?? (typeof navigator === "undefined" ? "" : navigator.platform);
  return /Mac|iPhone|iPad|iPod/i.test(value) ? "⌘" : "Ctrl";
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    !!target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")
  );
}

export const useKeyboardShortcuts = () => {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const selection = useEditorStore((s) => s.selection);
  const removeRow = useEditorStore((s) => s.removeRow);
  const removeBlockFromColumn = useEditorStore((s) => s.removeBlockFromColumn);
  const duplicateRow = useEditorStore((s) => s.duplicateRow);
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const selectNext = useEditorStore((s) => s.selectNext);
  const selectPrevious = useEditorStore((s) => s.selectPrevious);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isTyping = isTypingTarget(target);

      if (isTyping) {
        // Even when typing, Escape should blur the input and clear selection
        if (event.key === "Escape") {
          target?.blur();
          clearSelection();
        }
        return;
      }

      const isModKey = event.metaKey || event.ctrlKey;
      const isShift = event.shiftKey;

      // Escape: Clear Selection
      if (event.key === "Escape") {
        clearSelection();
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if (
        isModKey &&
        event.key.toLowerCase() === KEYBOARD_SHORTCUT_KEYS.undo &&
        !isShift
      ) {
        if (canUndo) {
          event.preventDefault();
          undo();
        }
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        (isModKey && isShift && event.key.toLowerCase() === KEYBOARD_SHORTCUT_KEYS.redo) ||
        (isModKey && event.key.toLowerCase() === KEYBOARD_SHORTCUT_KEYS.redoAlternative)
      ) {
        if (canRedo) {
          event.preventDefault();
          redo();
        }
        return;
      }

      // Delete / Backspace
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selection) return;

        if (selection.kind === "row") {
          event.preventDefault();
          removeRow(selection.id);
        } else if (selection.kind === "block") {
          // The selection carries its column, so there is nothing to look up.
          event.preventDefault();
          removeBlockFromColumn(selection.id, selection.columnId);
        }
        return;
      }

      // Arrow keys move the selection. With nothing selected they must keep
      // scrolling the canvas, which an unconditional preventDefault blocked.
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!selection) return;

        event.preventDefault();
        if (event.key === "ArrowDown") {
          selectNext();
        } else {
          selectPrevious();
        }
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if (isModKey && event.key.toLowerCase() === KEYBOARD_SHORTCUT_KEYS.duplicate) {
        if (!selection) return;

        if (selection.kind === "row") {
          event.preventDefault();
          duplicateRow(selection.id);
        } else if (selection.kind === "block") {
          event.preventDefault();
          duplicateBlock(selection.id, selection.columnId);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    undo, 
    redo, 
    canUndo, 
    canRedo, 
    selection, 
    removeRow, 
    removeBlockFromColumn, 
    duplicateRow, 
    duplicateBlock,
    clearSelection,
    selectNext,
    selectPrevious
  ]);
};











