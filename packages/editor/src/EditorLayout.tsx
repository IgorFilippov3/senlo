"use client";

import "./styles.css";

import { useEffect, FC, useState } from "react";
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
  templateName: string;
  templateSubject: string;
  mergeTags?: MergeTag[];
  onSave?: (
    id: number,
    design: EmailDesignDocument,
    html: string,
    metadata?: { name: string; subject: string },
  ) => Promise<any>;
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
  templateName,
  templateSubject,
  mergeTags = [],
  onSave,
  onSendTest,
  onListSavedRows,
  onSaveRow,
  onDeleteSavedRow,
}) => {
  const setDesign = useEditorStore((s) => s.setDesign);
  const setTemplateId = useEditorStore((s) => s.setTemplateId);
  const setTemplateMetadata = useEditorStore((s) => s.setTemplateMetadata);
  const setCustomMergeTags = useEditorStore((s) => s.setCustomMergeTags);
  const setOnSave = useEditorStore((s) => s.setOnSave);
  const setOnSendTest = useEditorStore((s) => s.setOnSendTest);
  const setSavedRowCallbacks = useEditorStore((s) => s.setSavedRowCallbacks);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setDesign(initialDesign);
    setTemplateId(templateId);
    setTemplateMetadata(templateName, templateSubject);
    setCustomMergeTags(mergeTags);
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

    setIsMounted(true);
  }, [
    initialDesign,
    templateId,
    templateName,
    templateSubject,
    mergeTags,
    setDesign,
    setTemplateId,
    setTemplateMetadata,
    setCustomMergeTags,
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
