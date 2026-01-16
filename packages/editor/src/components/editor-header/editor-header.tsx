"use client";

import styles from "./editor-header.module.css";
import { ArrowLeft, Undo2, Redo2, Download, Save, Eye, Settings2, Variable, Send } from "lucide-react";
import { useEditorStore } from "../../state/editor.store";
import { renderEmailDesign } from "@senlo/core";
import { Button, Dialog, FormField, Input } from "@senlo/ui";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExportModal } from "../export-modal/export-modal";
import { PreviewModal } from "../preview-modal/preview-modal";
import { TestSendModal } from "../test-send-modal/test-send-modal";

interface EditorHeaderProps {
  projectId: number;
}

export const EditorHeader = ({ projectId }: EditorHeaderProps) => {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const design = useEditorStore((s) => s.design);
  const templateId = useEditorStore((s) => s.templateId);
  const onSave = useEditorStore((s) => s.onSave);
  const setDirty = useEditorStore((s) => s.setDirty);
  const historyPast = useEditorStore((s) => s.historyPast);
  const historyFuture = useEditorStore((s) => s.historyFuture);
  const isDirty = useEditorStore((s) => s.isDirty);

  const templateName = useEditorStore((s) => s.templateName);
  const templateSubject = useEditorStore((s) => s.templateSubject);
  const setTemplateMetadata = useEditorStore((s) => s.setTemplateMetadata);

  const previewMode = useEditorStore((s) => s.previewMode);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);

  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");

  const [isSaving, setIsSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTestSendOpen, setIsTestSendOpen] = useState(false);

  const [editName, setEditName] = useState(templateName);
  const [editSubject, setEditSubject] = useState(templateSubject);

  useEffect(() => {
    setEditName(templateName);
    setEditSubject(templateSubject);
  }, [templateName, templateSubject]);

  // Compute canUndo/canRedo directly from history arrays
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  const handleBackClick = () => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmLeave) return;
    }

    if (campaignId) {
      router.push(`/campaigns/${campaignId}`);
    } else {
      router.push(`/projects/${projectId}`);
    }
  };

  const handleUndoClick = () => {
    undo();
  };

  const handleRedoClick = () => {
    redo();
  };

  const handleSaveClick = async () => {
    if (!onSave || !templateId) return;

    setIsSaving(true);
    try {
      const options = { baseUrl: window.location.origin };
      const html = renderEmailDesign(design, options);
      await onSave(templateId, design, html, {
        name: templateName,
        subject: templateSubject,
      });
      setDirty(false);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSave || !templateId) return;

    setIsSaving(true);
    try {
      const options = { baseUrl: window.location.origin };
      const html = renderEmailDesign(design, options);
      await onSave(templateId, design, html, {
        name: editName,
        subject: editSubject,
      });
      setTemplateMetadata(editName, editSubject);
      setIsSettingsOpen(false);
      // We don't need to setDirty(true) here since we just saved to server
    } catch (error) {
      console.error("Failed to update template info:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.content}>
        <button
          className={styles.backButton}
          onClick={handleBackClick}
          title="Go back"
        >
          <ArrowLeft size={22} />
        </button>

        <h1 className={styles.title}>
          <strong>{templateName || "Untitled Template"}</strong>
        </h1>

        <div className={styles.actions}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            title="Template Settings"
          >
            <Settings2 size={16} />
            <span>Info</span>
          </Button>

          <div className={styles.separator} />
          <button
            className={styles.actionButton}
            onClick={handleUndoClick}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 size={22} />
          </button>
          <button
            className={styles.actionButton}
            onClick={handleRedoClick}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 size={22} />
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveClick}
            disabled={isSaving}
          >
            <Save size={16} />
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewOpen(true)}
          >
            <Eye size={16} />
            <span>Preview</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTestSendOpen(true)}
            title="Send Test Email"
          >
            <Send size={16} />
            <span>Test</span>
          </Button>

          <Button
            variant={previewMode ? "primary" : "outline"}
            size="sm"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Variable size={16} />
            <span>{previewMode ? "Live Preview" : "Preview Tags"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
          >
            <Download size={16} />
            <span>Export</span>
          </Button>
        </div>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />

      <TestSendModal
        isOpen={isTestSendOpen}
        onClose={() => setIsTestSendOpen(false)}
      />

      <Dialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Template Info"
        description="Update the template name and email subject line."
      >
        <form onSubmit={handleSettingsSave} className="space-y-4">
          <FormField label="Template Name" required hint="Internal name for this template">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Welcome Email"
              required
            />
          </FormField>

          <FormField label="Email Subject" required hint="The subject line recipients will see">
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="e.g. Welcome to our community!"
              required
            />
          </FormField>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Updating..." : "Update Info"}
            </Button>
          </div>
        </form>
      </Dialog>
    </header>
  );
};
