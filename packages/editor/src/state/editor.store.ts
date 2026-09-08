/**
 * @fileoverview Main Zustand store for the email editor.
 * Provides centralized state management for email template editing functionality.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { WritableDraft } from "immer";
import { nanoid } from "nanoid";

import type { DragEndEvent } from "@dnd-kit/core";

import type {
  EmailDesignDocument,
  RowId,
  ColumnId,
  ContentBlockId,
  RowBlock,
  ContentBlock,
  ContentBlockType,
  MergeTag,
  SavedRow,
} from "@senlo/core";

import {
  EMPTY_EMAIL_DESIGN,
  createBlockData,
  migrateEmailDesign,
  migrateRow,
} from "@senlo/core";
import { LayoutPreset } from "../types/layout-preset";
import { SidebarTab } from "../types/sidebar-tab";
import { createColumns } from "./columns/create-columns";
import { findBlock, findColumn } from "./helpers";

/**
 * Represents the current selection state in the email editor.
 * Can be a row, column, block, or null if nothing is selected.
 */
/**
 * The selected element, together with the ids of whatever contains it.
 *
 * Storing only `{kind, id}` meant every consumer that needed the parent - the
 * delete shortcut, the duplicate shortcut, the property panel, the drop zones -
 * walked the whole document to find it. The parents are known at the moment of
 * selection, so they are recorded then.
 */
export type Selection =
  | { kind: "row"; id: RowId }
  | { kind: "column"; id: ColumnId; rowId: RowId }
  | { kind: "block"; id: ContentBlockId; columnId: ColumnId; rowId: RowId }
  | null;

/**
 * Main interface for the email editor store state and actions.
 * Combines all editor functionality into a single cohesive API.
 *
 * @example
 * ```tsx
 * import { useEditorStore } from './state/editor.store';
 *
 * function MyComponent() {
 *   const { design, selection, addRow, updateBlock } = useEditorStore();
 *
 *   const handleAddRow = () => {
 *     addRow('1col'); // Add single column row
 *   };
 *
 *   return <button onClick={handleAddRow}>Add Row</button>;
 * }
 * ```
 */
export interface EditorState {
  // Design State
  /** Current email design document containing all rows, columns, and blocks */
  design: EmailDesignDocument;
  /** Database ID of the template being edited, null for new templates */
  templateId: number | null;
  /** Database ID of the project the template belongs to */
  projectId: number | null;
  /** Whether the project has an AI provider configured */
  hasAiProvider: boolean;
  /** Display name of the template */
  templateName: string;
  /** Email subject line for the template */
  templateSubject: string;
  /** Hidden preview text shown by inboxes next to the subject */
  templatePreheader: string;
  /** Locale of the template (e.g. 'en', 'ru') */
  templateLocale: string;
  /** Custom merge tags available in the template */
  customMergeTags: MergeTag[];
  /** Whether the design has unsaved changes */
  isDirty: boolean;

  // Selection State
  /** Currently selected element (row, column, block) or null */
  selection: Selection;

  // UI State
  /** Currently active tab in the sidebar */
  activeSidebarTab: SidebarTab;
  /** Whether a drag operation is in progress */
  isDragActive: boolean;
  /** Type of element being dragged */
  activeDragType: "row" | "block" | "content" | "saved-row" | null;
  /** Whether preview mode is enabled */
  previewMode: boolean;
  /** Sample contact data for merge tag preview */
  previewContact: Record<string, any> | null;
  /** Currently active mode in the rows tab */
  rowsSidebarMode: "empty" | "saved";
  /** List of saved rows available to the user */
  savedRows: SavedRow[];
  /** Whether saved rows are currently being loaded */
  isLoadingSavedRows: boolean;
  /** Whether AI is currently generating a template */
  isAiGenerating: boolean;

  // History State
  /** Array of past design states for undo functionality */
  historyPast: EmailDesignDocument[];
  /** Array of future design states for redo functionality */
  historyFuture: EmailDesignDocument[];
  /** Whether undo operation is available */
  canUndo: boolean;
  /** Whether redo operation is available */
  canRedo: boolean;

  // Callback Functions
  /** Callback function for saving templates */
  onSave?: (
    id: number,
    design: EmailDesignDocument,
    html: string,
    metadata?: {
      name: string;
      subject: string;
      locale?: string;
      preheader?: string | null;
    },
  ) => Promise<{ success: boolean; error?: string } | void>;
  /** Callback function for sending test emails */
  onSendTest?: (
    id: number,
    targetEmail: string,
    fromEmail: string,
    design: EmailDesignDocument,
    subject: string,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Callback functions for saved rows */
  savedRowCallbacks: {
    onList?: () => Promise<SavedRow[]>;
    onSave?: (
      name: string,
      data: RowBlock,
    ) => Promise<{ success: boolean; data?: SavedRow }>;
    onDelete?: (id: number) => Promise<{ success: boolean }>;
  };

  // Design Actions
  /** Load a new design document into the editor */
  setDesign: (design: EmailDesignDocument) => void;
  /** Reset the store to its initial state (the store is a module singleton) */
  resetEditor: () => void;
  /** Update design document from AI with history tracking */
  updateDesignFromAi: (design: EmailDesignDocument) => void;
  /** Set the template database ID */
  setTemplateId: (id: number) => void;
  /** Set the project database ID and AI provider status */
  setProjectInfo: (projectId: number, hasAiProvider: boolean) => void;
  /** Update template name and subject line */
  setTemplateMetadata: (
    name: string,
    subject: string,
    locale?: string,
    preheader?: string,
  ) => void;
  /** Update available custom merge tags */
  setCustomMergeTags: (tags: MergeTag[]) => void;
  /** Reset design to empty state */
  resetDesign: () => void;
  /** Update global design settings with history tracking */
  updateGlobalSettings: (
    updates: Partial<EmailDesignDocument["settings"]>,
  ) => void;
  /** Update global design settings without history tracking */
  updateGlobalSettingsWithoutHistory: (
    updates: Partial<EmailDesignDocument["settings"]>,
  ) => void;
  /** Mark design as dirty/clean */
  setDirty: (isDirty: boolean) => void;
  /** Set AI generation state */
  setIsAiGenerating: (isGenerating: boolean) => void;

  // Selection Actions
  /** Select a specific element */
  select: (sel: Selection) => void;
  /** Clear current selection */
  clearSelection: () => void;
  /** Navigate to next element */
  selectNext: () => void;
  /** Navigate to previous element */
  selectPrevious: () => void;

  // UI Actions
  /** Switch active sidebar tab */
  setActiveSidebarTab: (tab: SidebarTab) => void;
  /** Set drag operation state */
  setDragActive: (
    isActive: boolean,
    type?: "row" | "block" | "content" | "saved-row" | null,
  ) => void;
  /** Toggle preview mode */
  setPreviewMode: (enabled: boolean) => void;
  /** Set sample contact for merge tag preview */
  setPreviewContact: (contact: Record<string, any> | null) => void;
  /** Handle drag and drop operations */
  handleDragEnd: (event: DragEndEvent) => void;

  // History Actions
  /** Undo the last design change */
  undo: () => void;
  /** Redo the next design change */
  redo: () => void;
  /** Manually push current state to history */
  pushToHistory: () => void;

  // Row Actions
  /** Add a new row with specified layout at the end */
  addRow: (preset: LayoutPreset) => void;
  /** Add a new row at specific position */
  addRowAtPosition: (preset: LayoutPreset, position?: number) => void;
  /** Remove a row by ID */
  removeRow: (rowId: RowId) => void;
  /** Create a duplicate of a row with new IDs */
  duplicateRow: (rowId: RowId) => void;
  /** Move a row up or down */
  moveRow: (rowId: RowId, direction: "up" | "down") => void;
  /** Update row settings with history tracking */
  updateRow: (
    rowId: RowId,
    updates: Partial<RowBlock["settings"]>,
    condition?: RowBlock["condition"],
    loop?: RowBlock["loop"],
  ) => void;
  /** Update row settings without history tracking */
  updateRowWithoutHistory: (
    rowId: RowId,
    updates: Partial<RowBlock["settings"]>,
    condition?: RowBlock["condition"],
    loop?: RowBlock["loop"],
  ) => void;

  // Block Actions
  /** Add a new block to the last available column */
  addBlock: (type: ContentBlockType) => void;
  /** Add a block to a specific column at optional position */
  addBlockToColumn: (
    type: ContentBlockType,
    columnId: ColumnId,
    position?: number,
  ) => void;
  /** Move a block to new position within the same column */
  moveBlockWithinColumn: (
    blockId: ContentBlockId,
    columnId: ColumnId,
    newPosition: number,
  ) => void;
  /** Move a block from one column to another */
  moveBlockBetweenColumns: (
    blockId: ContentBlockId,
    sourceColumnId: ColumnId,
    targetColumnId: ColumnId,
    position: number,
  ) => void;
  /** Remove a block from its column */
  removeBlockFromColumn: (blockId: ContentBlockId, columnId: ColumnId) => void;
  /** Create a duplicate of a block with new ID */
  duplicateBlock: (blockId: ContentBlockId, columnId: ColumnId) => void;
  /** Update block data with history tracking */
  updateBlock: (
    blockId: ContentBlockId,
    updates: Partial<ContentBlock["data"]>,
    condition?: ContentBlock["condition"],
  ) => void;
  /** Update block data without history tracking */
  updateBlockWithoutHistory: (
    blockId: ContentBlockId,
    updates: Partial<ContentBlock["data"]>,
    condition?: ContentBlock["condition"],
  ) => void;

  // Callback Setters
  /** Set save callback function */
  setOnSave: (
    fn: (
      id: number,
      design: EmailDesignDocument,
      html: string,
      metadata?: {
        name: string;
        subject: string;
        locale?: string;
        preheader?: string | null;
      },
    ) => Promise<{ success: boolean; error?: string } | void>,
  ) => void;
  /** Set test email callback function */
  setOnSendTest: (
    fn: (
      id: number,
      targetEmail: string,
      fromEmail: string,
      design: EmailDesignDocument,
      subject: string,
    ) => Promise<{ success: boolean; error?: string }>,
  ) => void;
  /** Set saved row callback functions */
  setSavedRowCallbacks: (callbacks: EditorState["savedRowCallbacks"]) => void;
  /** Switch the mode in the rows sidebar tab */
  setRowsSidebarMode: (mode: "empty" | "saved") => void;
  /** Fetch the list of saved rows from the server */
  loadSavedRows: () => Promise<void>;
  /** Save a row to the library */
  saveRowToLibrary: (name: string, rowId: RowId) => Promise<boolean>;
  /** Delete a row from the library */
  deleteSavedRow: (id: number) => Promise<boolean>;
  /** Add a saved row to the design */
  addSavedRowToDesign: (savedRow: SavedRow, position?: number) => void;
}

/** Maximum number of design states stored in history for undo/redo functionality */
const MAX_HISTORY_SIZE = 50;

/** Sample contact shown in preview mode before real data is supplied. */
const DEFAULT_PREVIEW_CONTACT = {
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@example.com",
};

/** Fallback global settings for documents saved before a field existed. */
const DEFAULT_GLOBAL_SETTINGS = {
  backgroundColor: "#ffffff",
  contentWidth: 600,
  fontFamily: "Arial, sans-serif",
  textColor: "#111827",
} as const;

/**
 * Applies a change and records the state that preceded it.
 *
 * The previous design is read outside the mutation, where it is a finished
 * immutable object rather than an immer draft, so it can be kept as-is. The old
 * code cloned it with `JSON.parse(JSON.stringify(...))` on every keystroke -
 * fifty full copies of the document in memory, and any key whose value was
 * `undefined` silently disappeared from the copy. Immer already shares
 * structure between versions, so a history entry now costs only the nodes that
 * actually changed.
 */
/**
 * Selects a block and records its parents. The lookup happens once, when the
 * selection changes, instead of in every consumer on every render.
 */
const selectBlock = (
  s: WritableDraft<EditorState>,
  blockId: ContentBlockId,
) => {
  const found = findBlock(s.design, blockId);
  s.selection = found
    ? {
        kind: "block" as const,
        id: blockId,
        columnId: found.column.id,
        rowId: found.row.id,
      }
    : null;
};

const commit = (
  set: (fn: (s: WritableDraft<EditorState>) => void) => void,
  get: () => EditorState,
  recipe: (s: WritableDraft<EditorState>) => void,
) => {
  const previous = get().design;

  set((s) => {
    s.historyPast =
      s.historyPast.length >= MAX_HISTORY_SIZE
        ? [...s.historyPast.slice(-(MAX_HISTORY_SIZE - 1)), previous]
        : [...s.historyPast, previous];
    s.historyFuture = [];

    s.canUndo = true;
    s.canRedo = false;
    s.isDirty = true;

    recipe(s);
  });
};

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    design: EMPTY_EMAIL_DESIGN,
    templateId: null,
    projectId: null,
    hasAiProvider: false,
    selection: null,
    activeSidebarTab: "rows",
    isDragActive: false,
    activeDragType: null,
    isDirty: false,
    customMergeTags: [],

    // History state
    historyPast: [],
    historyFuture: [],
    canUndo: false,
    canRedo: false,

    templateName: "",
    templateSubject: "",
    templateLocale: "en",
    templatePreheader: "",

    previewMode: false,
    previewContact: { ...DEFAULT_PREVIEW_CONTACT },
    rowsSidebarMode: "empty",
    savedRows: [],
    isLoadingSavedRows: false,
    isAiGenerating: false,

    setPreviewMode: (enabled) => {
      set((s) => {
        s.previewMode = enabled;
      });
    },

    setPreviewContact: (contact) => {
      set((s) => {
        s.previewContact = contact;
      });
    },

    setTemplateMetadata: (name, subject, locale, preheader) => {
      set((s) => {
        s.templateName = name;
        s.templateSubject = subject;
        if (locale) s.templateLocale = locale;
        if (preheader !== undefined) s.templatePreheader = preheader;
      });
    },

    resetEditor: () => {
      set((s) => {
        s.design = EMPTY_EMAIL_DESIGN;
        s.templateId = null;
        s.selection = null;
        s.historyPast = [];
        s.historyFuture = [];
        s.canUndo = false;
        s.canRedo = false;
        s.isDirty = false;
        s.previewMode = false;
        s.templatePreheader = "";
        s.previewContact = { ...DEFAULT_PREVIEW_CONTACT };
        s.isDragActive = false;
        s.activeDragType = null;
        // Saved rows are scoped to a project: keeping them would show the
        // previous project's library for a moment after navigating.
        s.savedRows = [];
        s.isLoadingSavedRows = false;
        s.rowsSidebarMode = "empty";
      });
    },

    setDesign: (design) => {
      set((s) => {
        // A document saved by an older editor is reshaped once, here, so every
        // component below works with the current format only.
        s.design = migrateEmailDesign(design);
        s.isDirty = false;
        // Initialize settings if missing in loaded design
        if (!s.design.settings) {
          s.design.settings = { ...DEFAULT_GLOBAL_SETTINGS };
        }
      });
    },

    updateDesignFromAi: (design) => {
      commit(set, get, (s) => {
        s.design = migrateEmailDesign(design);
        s.isDirty = true;
        // Initialize settings if missing in loaded design
        if (!s.design.settings) {
          s.design.settings = { ...DEFAULT_GLOBAL_SETTINGS };
        }
      });
    },

    setTemplateId: (id) => {
      set((s) => {
        s.templateId = id;
      });
    },

    setProjectInfo: (projectId, hasAiProvider) => {
      set((s) => {
        s.projectId = projectId;
        s.hasAiProvider = hasAiProvider;
      });
    },

    setCustomMergeTags: (tags) => {
      set((s) => {
        s.customMergeTags = tags;
      });
    },

    resetDesign: () => {
      set((s) => {
        s.design = EMPTY_EMAIL_DESIGN;
        s.selection = null;
        s.historyPast = [];
        s.historyFuture = [];
        s.canUndo = false;
        s.canRedo = false;
      });
    },

    select: (sel) => {
      set((s) => {
        s.selection = sel;
      });
    },

    clearSelection: () => {
      set((s) => {
        s.selection = null;
      });
    },

    setActiveSidebarTab: (tab) => {
      set((s) => {
        s.activeSidebarTab = tab;
      });
    },

    setDragActive: (isActive, type = null) => {
      set((s) => {
        s.isDragActive = isActive;
        s.activeDragType = isActive ? type : null;
      });
    },


    setDirty: (isDirty) => {
      set((s) => {
        s.isDirty = isDirty;
      });
    },

    setIsAiGenerating: (isGenerating) => {
      set((s) => {
        s.isAiGenerating = isGenerating;
      });
    },

    // History actions
    undo: () => {
      set((s) => {
        if (s.historyPast.length === 0) return;

        const previous = s.historyPast[s.historyPast.length - 1];
        s.historyPast = s.historyPast.slice(0, -1);
        s.historyFuture = [s.design, ...s.historyFuture];
        s.design = previous;
        s.selection = null; // Clear selection on undo
        s.isDirty = true;

        s.canUndo = s.historyPast.length > 0;
        s.canRedo = s.historyFuture.length > 0;
      });
    },

    redo: () => {
      set((s) => {
        if (s.historyFuture.length === 0) return;

        const next = s.historyFuture[0];
        s.historyFuture = s.historyFuture.slice(1);
        s.historyPast = [...s.historyPast, s.design];
        s.design = next;
        s.selection = null; // Clear selection on redo
        s.isDirty = true;

        s.canUndo = s.historyPast.length > 0;
        s.canRedo = s.historyFuture.length > 0;
      });
    },

    pushToHistory: () => {
      set((s) => {
        // Add current state to history
        s.historyPast = [
          ...s.historyPast,
          JSON.parse(JSON.stringify(s.design)),
        ];

        // Limit history size
        if (s.historyPast.length > MAX_HISTORY_SIZE) {
          s.historyPast = s.historyPast.slice(-MAX_HISTORY_SIZE);
        }

        // Clear future when new state is pushed
        s.historyFuture = [];

        s.canUndo = s.historyPast.length > 0;
        s.canRedo = s.historyFuture.length > 0;
      });
    },

    addRow: (preset) => {
      commit(set, get, (s) => {
        const row = createRow(preset);
        s.design.rows.push(row);
        s.selection = { kind: "row", id: row.id };
      });
    },

    addBlock: (type) => {
      commit(set, get, (s) => {
        if (s.design.rows.length === 0) {
          const row = createRow("1col");
          s.design.rows.push(row);
        }

        const lastRow = s.design.rows[s.design.rows.length - 1];

        if (!lastRow.columns || lastRow.columns.length === 0) {
          lastRow.columns = createColumns("1col");
        }

        const targetColumn = lastRow.columns[0];
        const block = createBlock(type);

        targetColumn.blocks.push(block);

        selectBlock(s, block.id);
      });
    },

    handleDragEnd: (event) => {
      const { active, over } = event;

      if (!over) return;

      const dragType = active.data.current?.type;
      const dragData = active.data.current?.data;
      const overType = over.data.current?.type;

      if (dragType === "row") {
        if (overType === "row-drop-zone") {
          const position = over.data.current?.position as number;
          get().addRowAtPosition(dragData as LayoutPreset, position);
        } else if (overType === "canvas" || over.id === "canvas-drop-zone") {
          get().addRowAtPosition(dragData as LayoutPreset);
        }
      } else if (dragType === "saved-row") {
        const savedRow = dragData as SavedRow;
        if (overType === "row-drop-zone") {
          const position = over.data.current?.position as number;
          get().addSavedRowToDesign(savedRow, position);
        } else if (overType === "canvas" || over.id === "canvas-drop-zone") {
          get().addSavedRowToDesign(savedRow);
        }
      } else if (dragType === "content") {
        if (overType === "column") {
          const columnId = over.id as ColumnId;
          get().addBlockToColumn(dragData as ContentBlockType, columnId);
        } else if (overType === "block-drop-zone") {
          const columnId = over.data.current?.columnId as ColumnId;
          const position = over.data.current?.position as number;
          get().addBlockToColumn(
            dragData as ContentBlockType,
            columnId,
            position,
          );
        } else if (over.id === "canvas-drop-zone") {
          return;
        }
      } else if (dragType === "block") {
        const blockData = dragData as {
          blockId: ContentBlockId;
          sourceColumnId: ColumnId;
          sourceRowId: string;
          blockType: ContentBlockType;
          blockData: ContentBlock;
        };

        if (overType === "column") {
          const targetColumnId = over.data.current?.columnId as ColumnId;
          if (targetColumnId !== blockData.sourceColumnId) {
            get().moveBlockBetweenColumns(
              blockData.blockId,
              blockData.sourceColumnId,
              targetColumnId,
              0,
            );
          }
        } else if (overType === "block-drop-zone") {
          const targetColumnId = over.data.current?.columnId as ColumnId;
          const position = over.data.current?.position as number;

          if (targetColumnId === blockData.sourceColumnId) {
            // Moving within same column
            get().moveBlockWithinColumn(
              blockData.blockId,
              targetColumnId,
              position,
            );
          } else {
            // Moving between columns
            get().moveBlockBetweenColumns(
              blockData.blockId,
              blockData.sourceColumnId,
              targetColumnId,
              position,
            );
          }
        }
      }
    },

    addBlockToColumn: (type, columnId, position) => {
      commit(set, get, (s) => {
        const columnResult = findColumn(s.design, columnId);
        if (columnResult) {
          const block = createBlock(type);
          if (
            position !== undefined &&
            position >= 0 &&
            position <= columnResult.column.blocks.length
          ) {
            columnResult.column.blocks.splice(position, 0, block);
          } else {
            columnResult.column.blocks.push(block);
          }
          selectBlock(s, block.id);
        }
      });
    },

    addRowAtPosition: (preset, position) => {
      commit(set, get, (s) => {
        const row = createRow(preset);
        if (position !== undefined) {
          s.design.rows.splice(position, 0, row);
        } else {
          s.design.rows.push(row);
        }
        s.selection = { kind: "row", id: row.id };
      });
    },

    removeRow: (rowId) => {
      commit(set, get, (s) => {
        const index = s.design.rows.findIndex((row) => row.id === rowId);
        if (index !== -1) {
          s.design.rows.splice(index, 1);

          if (s.selection?.kind === "row" && s.selection.id === rowId) {
            s.selection = null;
          }
        }
      });
    },

    duplicateRow: (rowId) => {
      commit(set, get, (s) => {
        const index = s.design.rows.findIndex((row) => row.id === rowId);
        if (index !== -1) {
          const originalRow = s.design.rows[index];

          // Deep clone the row with new IDs
          const duplicatedRow: RowBlock = {
            ...originalRow,
            id: nanoid() as RowId,
            columns: originalRow.columns.map((column) => ({
              ...column,
              id: nanoid() as ColumnId,
              blocks: column.blocks.map((block) => ({
                ...block,
                id: nanoid() as ContentBlockId,
              })),
            })),
          };

          // Insert the duplicated row right after the original
          s.design.rows.splice(index + 1, 0, duplicatedRow);

          // Select the newly created row
          s.selection = { kind: "row", id: duplicatedRow.id };
        }
      });
    },

    moveRow: (rowId, direction) => {
      const rows = get().design.rows;
      const index = rows.findIndex((row) => row.id === rowId);
      if (index === -1) return;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= rows.length) return;

      commit(set, get, (s) => {
        const [row] = s.design.rows.splice(index, 1);
        s.design.rows.splice(targetIndex, 0, row);

        s.selection = { kind: "row", id: rowId };
      });
    },

    selectNext: () => {
      set((s) => {
        if (!s.selection) {
          // If nothing selected, select first row or first block
          if (s.design.rows.length > 0) {
            const firstRow = s.design.rows[0];
            if (firstRow.columns[0]?.blocks.length > 0) {
              selectBlock(s, firstRow.columns[0].blocks[0].id);
            } else {
              s.selection = { kind: "row", id: firstRow.id };
            }
          }
          return;
        }

        if (s.selection.kind === "row") {
          const index = s.design.rows.findIndex(
            (r) => r.id === s.selection?.id,
          );
          if (index !== -1 && index < s.design.rows.length - 1) {
            s.selection = { kind: "row", id: s.design.rows[index + 1].id };
          }
        } else if (s.selection.kind === "block") {
          // Flatten all blocks to find the current one
          const allBlocks: { id: ContentBlockId }[] = [];
          s.design.rows.forEach((r) => {
            r.columns.forEach((c) => {
              c.blocks.forEach((b) => {
                allBlocks.push({ id: b.id });
              });
            });
          });

          const currentIndex = allBlocks.findIndex(
            (b) => b.id === s.selection?.id,
          );
          if (currentIndex !== -1 && currentIndex < allBlocks.length - 1) {
            selectBlock(s, allBlocks[currentIndex + 1].id);
          }
        }
      });
    },

    selectPrevious: () => {
      set((s) => {
        if (!s.selection) return;

        if (s.selection.kind === "row") {
          const index = s.design.rows.findIndex(
            (r) => r.id === s.selection?.id,
          );
          if (index > 0) {
            s.selection = { kind: "row", id: s.design.rows[index - 1].id };
          }
        } else if (s.selection.kind === "block") {
          const allBlocks: { id: ContentBlockId }[] = [];
          s.design.rows.forEach((r) => {
            r.columns.forEach((c) => {
              c.blocks.forEach((b) => {
                allBlocks.push({ id: b.id });
              });
            });
          });

          const currentIndex = allBlocks.findIndex(
            (b) => b.id === s.selection?.id,
          );
          if (currentIndex > 0) {
            selectBlock(s, allBlocks[currentIndex - 1].id);
          }
        }
      });
    },

    moveBlockWithinColumn: (blockId, columnId, newPosition) => {
      // Dropping a block back where it started is not an edit: it used to add
      // an undo step and mark the document unsaved.
      const current = findBlock(get().design, blockId);
      if (
        !current ||
        newPosition === current.blockIndex ||
        newPosition === current.blockIndex + 1
      ) {
        return;
      }

      commit(set, get, (s) => {
        const blockResult = findBlock(s.design, blockId);
        if (blockResult) {
          const [block] = blockResult.column.blocks.splice(
            blockResult.blockIndex,
            1,
          );

          // Adjust position if moving down and target position is after current
          const adjustedPosition =
            newPosition > blockResult.blockIndex
              ? newPosition - 1
              : newPosition;
          blockResult.column.blocks.splice(
            Math.max(
              0,
              Math.min(adjustedPosition, blockResult.column.blocks.length),
            ),
            0,
            block,
          );

          selectBlock(s, blockId);
        }
      });
    },

    moveBlockBetweenColumns: (
      blockId,
      sourceColumnId,
      targetColumnId,
      position,
    ) => {
      commit(set, get, (s) => {
        let sourceColumn = null;
        let targetColumn = null;
        let blockToMove = null;

        // Find source column and block
        for (const row of s.design.rows) {
          const column = row.columns.find((col) => col.id === sourceColumnId);
          if (column) {
            const blockIndex = column.blocks.findIndex(
              (block) => block.id === blockId,
            );
            if (blockIndex !== -1) {
              sourceColumn = column;
              blockToMove = column.blocks[blockIndex];
              break;
            }
          }
        }

        // Find target column
        for (const row of s.design.rows) {
          const column = row.columns.find((col) => col.id === targetColumnId);
          if (column) {
            targetColumn = column;
            break;
          }
        }

        if (sourceColumn && targetColumn && blockToMove) {
          // Remove from source
          const sourceIndex = sourceColumn.blocks.findIndex(
            (block) => block.id === blockId,
          );
          sourceColumn.blocks.splice(sourceIndex, 1);

          // Add to target
          const safePosition = Math.max(
            0,
            Math.min(position, targetColumn.blocks.length),
          );
          targetColumn.blocks.splice(safePosition, 0, blockToMove);

          selectBlock(s, blockId);
        }
      });
    },

    removeBlockFromColumn: (blockId, columnId) => {
      commit(set, get, (s) => {
        const blockResult = findBlock(s.design, blockId);
        if (blockResult) {
          blockResult.column.blocks.splice(blockResult.blockIndex, 1);

          if (s.selection?.kind === "block" && s.selection.id === blockId) {
            s.selection = null;
          }
        }
      });
    },

    duplicateBlock: (blockId, columnId) => {
      commit(set, get, (s) => {
        const blockResult = findBlock(s.design, blockId);
        if (blockResult) {
          const duplicatedBlock = {
            ...blockResult.block,
            id: nanoid() as ContentBlockId,
          };

          // Insert the duplicated block right after the original
          blockResult.column.blocks.splice(
            blockResult.blockIndex + 1,
            0,
            duplicatedBlock,
          );

          // Select the newly created block
          selectBlock(s, duplicatedBlock.id);
        }
      });
    },

    updateBlock: (blockId, updates, condition) => {
      const state = get();
      let currentBlock: ContentBlock | undefined;

      for (const row of state.design.rows) {
        for (const column of row.columns) {
          currentBlock = column.blocks.find((b) => b.id === blockId);
          if (currentBlock) break;
        }
        if (currentBlock) break;
      }

      if (!currentBlock) return;

      // Check if there are actual changes
      const dataHasChanges = Object.entries(updates).some(([key, value]) => {
        return (
          JSON.stringify(
            currentBlock?.data[key as keyof typeof currentBlock.data],
          ) !== JSON.stringify(value)
        );
      });

      const conditionHasChanges =
        JSON.stringify(currentBlock.condition) !== JSON.stringify(condition);

      if (!dataHasChanges && !conditionHasChanges) return;

      commit(set, get, (s) => {
        const blockResult = findBlock(s.design, blockId);
        if (blockResult) {
          Object.assign(blockResult.block.data, updates);
          blockResult.block.condition = condition;
        }
      });
    },

    updateBlockWithoutHistory: (blockId, updates, condition) => {
      set((s) => {
        const blockResult = findBlock(s.design, blockId);
        if (blockResult) {
          // Update block data with new values without saving to history
          Object.assign(blockResult.block.data, updates);
          blockResult.block.condition = condition;
          // No history step, but the document did change: without this the
          // unsaved-changes guard misses everything typed in the last 500ms
          // before the form unmounts.
          s.isDirty = true;
        }
      });
    },

    updateRow: (rowId, updates, condition, loop) => {
      const state = get();
      const currentRow = state.design.rows.find((r) => r.id === rowId);
      if (!currentRow) return;

      const settingsHasChanges = Object.entries(updates).some(
        ([key, value]) => {
          return (
            JSON.stringify(
              currentRow.settings[key as keyof typeof currentRow.settings],
            ) !== JSON.stringify(value)
          );
        },
      );

      const conditionHasChanges =
        JSON.stringify(currentRow.condition) !== JSON.stringify(condition);

      const loopHasChanges =
        JSON.stringify(currentRow.loop) !== JSON.stringify(loop);

      if (!settingsHasChanges && !conditionHasChanges && !loopHasChanges)
        return;

      commit(set, get, (s) => {
        const row = s.design.rows.find((r) => r.id === rowId);
        if (row) {
          Object.assign(row.settings, updates);
          row.condition = condition;
          row.loop = loop;
        }
      });
    },

    updateRowWithoutHistory: (rowId, updates, condition, loop) => {
      set((s) => {
        const row = s.design.rows.find((r) => r.id === rowId);
        if (row) {
          Object.assign(row.settings, updates);
          row.condition = condition;
          row.loop = loop;
          s.isDirty = true;
        }
      });
    },

    updateGlobalSettings: (updates) => {
      const state = get();
      const hasChanges = Object.entries(updates).some(([key, value]) => {
        return (
          JSON.stringify(
            state.design.settings?.[key as keyof typeof state.design.settings],
          ) !== JSON.stringify(value)
        );
      });

      if (!hasChanges) return;

      commit(set, get, (s) => {
        if (!s.design.settings) {
          s.design.settings = { ...DEFAULT_GLOBAL_SETTINGS };
        }
        Object.assign(s.design.settings, updates);
      });
    },

    updateGlobalSettingsWithoutHistory: (updates) => {
      set((s) => {
        if (!s.design.settings) {
          s.design.settings = { ...DEFAULT_GLOBAL_SETTINGS };
        }
        Object.assign(s.design.settings, updates);
        s.isDirty = true;
      });
    },

    onSave: undefined,
    setOnSave: (fn) => {
      set((s) => {
        s.onSave = fn;
      });
    },

    onSendTest: undefined,
    setOnSendTest: (fn) => {
      set((s) => {
        s.onSendTest = fn;
      });
    },

    savedRowCallbacks: {},
    setSavedRowCallbacks: (callbacks) => {
      set((s) => {
        s.savedRowCallbacks = callbacks;
      });
    },

    setRowsSidebarMode: (mode) => {
      set((s) => {
        s.rowsSidebarMode = mode;
      });
      if (mode === "saved") {
        get().loadSavedRows();
      }
    },

    loadSavedRows: async () => {
      const { onList } = get().savedRowCallbacks;
      if (!onList) return;

      set((s) => {
        s.isLoadingSavedRows = true;
      });

      try {
        const rows = await onList();
        set((s) => {
          // A saved row carries no version, so every migration runs and each
          // decides for itself whether it applies.
          s.savedRows = rows.map((row) => ({
            ...row,
            data: migrateRow(row.data),
          }));
        });
      } catch (error) {
        console.error("Failed to load saved rows:", error);
      } finally {
        set((s) => {
          s.isLoadingSavedRows = false;
        });
      }
    },

    saveRowToLibrary: async (name, rowId) => {
      const { onSave } = get().savedRowCallbacks;
      if (!onSave) return false;

      const row = get().design.rows.find((r) => r.id === rowId);
      if (!row) return false;

      try {
        const result = await onSave(name, row);
        if (result.success && result.data) {
          set((s) => {
            s.savedRows = [result.data!, ...s.savedRows];
          });
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to save row to library:", error);
        return false;
      }
    },

    deleteSavedRow: async (id) => {
      const { onDelete } = get().savedRowCallbacks;
      if (!onDelete) return false;

      try {
        const result = await onDelete(id);
        if (result.success) {
          set((s) => {
            s.savedRows = s.savedRows.filter((r) => r.id !== id);
          });
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to delete saved row:", error);
        return false;
      }
    },

    addSavedRowToDesign: (savedRow, position) => {
      commit(set, get, (s) => {
        const originalData = savedRow.data as RowBlock;
        const newRow: RowBlock = {
          ...originalData,
          id: nanoid() as RowId,
          columns: originalData.columns.map((column) => ({
            ...column,
            id: nanoid() as ColumnId,
            blocks: column.blocks.map((block) => ({
              ...block,
              id: nanoid() as ContentBlockId,
            })),
          })),
        };

        if (position !== undefined) {
          s.design.rows.splice(position, 0, newRow);
        } else {
          s.design.rows.push(newRow);
        }
        s.selection = { kind: "row", id: newRow.id };
      });
    },
  })),
);

/**
 * Creates a new row block with specified column layout.
 * Each row contains columns that can hold content blocks.
 *
 * @param preset - Layout preset defining the column structure (e.g., '1col', '2col', '3col')
 * @returns A new row block with generated ID, default settings, and columns based on the preset
 */
function createRow(preset: LayoutPreset): RowBlock {
  return {
    id: nanoid() as RowId,
    type: "row",
    columns: createColumns(preset),
    settings: {
      backgroundColor: "#ffffff",
      fullWidth: false,
      align: "center",
      padding: {
        top: 0,
        right: 16,
        bottom: 0,
        left: 16,
      },
    },
  };
}


/**
 * Wraps the registry's default data in a block envelope. The defaults
 * themselves live with the block definition in `@senlo/core`, so the renderer,
 * the property panel and this factory can never disagree about them.
 */
function createBlock(type: ContentBlockType): ContentBlock {
  return {
    id: nanoid() as ContentBlockId,
    type,
    data: createBlockData(type),
  } as ContentBlock;
}
