"use client";

import "./styles.css";

import { useEffect, useRef, FC, useState } from "react";
import { EmailDesignDocument, MergeTag, SavedRow, RowBlock } from "@senlo/core";
import { Sidebar } from "./components/sidebar/sidebar";
import { EmailCanvas } from "./components/email-canvas/email-canvas";
import { EditorHeader } from "./components/editor-header/editor-header";
import { PropsManager } from "./components/props-manager/props-manager";

import { useEditorStore } from "./state/editor.store";
import { DndEditorContent } from "./components/dnd-editor-content/dnd-editor-content";

interface EditorLayoutProps {
  initialDesign: EmailDesignDocument;
  templateId: number;
  projectId: number;
  hasAiProvider?: boolean;
  templateName: string;
  templateSubject: string;
  templateLocale?: string;
  templatePreheader?: string | null;
  mergeTags?: MergeTag[];
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
  onSendTest?: (
    id: number,
    targetEmail: string,
    fromEmail: string,
    design: EmailDesignDocument,
    subject: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onListSavedRows?: () => Promise<SavedRow[]>;
  onSaveRow?: (
    name: string,
    data: RowBlock,
  ) => Promise<{ success: boolean; data?: SavedRow }>;
  onDeleteSavedRow?: (id: number) => Promise<{ success: boolean }>;
}

export const EditorLayout: FC<EditorLayoutProps> = ({
  initialDesign,
  templateId,
  projectId,
  hasAiProvider = false,
  templateName,
  templateSubject,
  templateLocale = "en",
  templatePreheader = "",
  mergeTags = [],
  onSave,
  onSendTest,
  onListSavedRows,
  onSaveRow,
  onDeleteSavedRow,
}) => {
  const setDesign = useEditorStore((s) => s.setDesign);
  const setTemplateId = useEditorStore((s) => s.setTemplateId);
  const setProjectInfo = useEditorStore((s) => s.setProjectInfo);
  const setTemplateMetadata = useEditorStore((s) => s.setTemplateMetadata);
  const setCustomMergeTags = useEditorStore((s) => s.setCustomMergeTags);
  const setOnSave = useEditorStore((s) => s.setOnSave);
  const setOnSendTest = useEditorStore((s) => s.setOnSendTest);
  const setSavedRowCallbacks = useEditorStore((s) => s.setSavedRowCallbacks);
  const resetEditor = useEditorStore((s) => s.resetEditor);
  const [isMounted, setIsMounted] = useState(false);

  // The document is loaded from props exactly once per template. Server props
  // get fresh identities on every render of the parent - `mergeTags` is rebuilt
  // as a new array, and `revalidatePath` after a save re-renders the page - so
  // a document effect that depended on them would replace the design (and clear
  // isDirty) while the user is editing.
  const initialDesignRef = useRef(initialDesign);
  initialDesignRef.current = initialDesign;
  const templateMetaRef = useRef({
    templateName,
    templateSubject,
    templateLocale,
    templatePreheader,
    projectId,
    hasAiProvider,
  });
  templateMetaRef.current = {
    templateName,
    templateSubject,
    templateLocale,
    templatePreheader,
    projectId,
    hasAiProvider,
  };

  useEffect(() => {
    const meta = templateMetaRef.current;

    setDesign(initialDesignRef.current);
    setTemplateId(templateId);
    setProjectInfo(meta.projectId, meta.hasAiProvider);
    setTemplateMetadata(
      meta.templateName,
      meta.templateSubject,
      meta.templateLocale,
      meta.templatePreheader ?? "",
    );
    setIsMounted(true);
  }, [
    templateId,
    setDesign,
    setTemplateId,
    setProjectInfo,
    setTemplateMetadata,
  ]);

  // The store is a module singleton, so it outlives this component. Without a
  // reset, navigating to another template briefly shows the previous document.
  useEffect(() => {
    return () => {
      resetEditor();
    };
  }, [resetEditor]);

  // Callbacks and merge tags can be refreshed freely: none of them touch the
  // document.
  useEffect(() => {
    setCustomMergeTags(mergeTags);
  }, [mergeTags, setCustomMergeTags]);

  useEffect(() => {
    if (onSave) {
      setOnSave(onSave);
    }
    if (onSendTest) {
      setOnSendTest(onSendTest);
    }

    setSavedRowCallbacks({
      onList: onListSavedRows,
      onSave: onSaveRow,
      onDelete: onDeleteSavedRow,
    });
  }, [
    onSave,
    setOnSave,
    onSendTest,
    setOnSendTest,
    onListSavedRows,
    onSaveRow,
    onDeleteSavedRow,
    setSavedRowCallbacks,
  ]);

  if (!isMounted) {
    return (
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
    );
  }

  return <DndEditorContent projectId={projectId} />;
};
