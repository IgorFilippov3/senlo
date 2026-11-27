"use client";

import styles from "./editor-header.module.css";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Save,
  Eye,
  Settings2,
  Variable,
  Send,
  Keyboard,
} from "lucide-react";
import { useEditorStore } from "../../state/editor.store";
import { renderEmailDesign } from "@senlo/core";
import { Button, Dialog, FormField, Input } from "@senlo/ui";
import { useState, useEffect } from "react";
import { ExportModal } from "../export-modal/export-modal";
import { PreviewModal } from "../preview-modal/preview-modal";
import { TestSendModal } from "../test-send-modal/test-send-modal";
import { useEditorHost } from "../../host";
import { useLeaveEditor } from "../../hooks/use-leave-editor";
import {
  getKeyboardShortcutModifier,
  isTypingTarget,
  KEYBOARD_SHORTCUTS,
  type KeyboardShortcutModifier,
} from "../../hooks/use-keyboard-shortcuts";

export const EditorHeader = () => {
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
  const templateLocale = useEditorStore((s) => s.templateLocale);
  const templatePreheader = useEditorStore((s) => s.templatePreheader);
  const setTemplateMetadata = useEditorStore((s) => s.setTemplateMetadata);

  const previewMode = useEditorStore((s) => s.previewMode);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);

  const { baseUrl } = useEditorHost();
  const leave = useLeaveEditor();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Kept apart from saveError: the header banner sits behind the settings
  // dialog, so a failure there has to be shown inside the dialog itself.
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTestSendOpen, setIsTestSendOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [shortcutModifier, setShortcutModifier] = useState<KeyboardShortcutModifier>("Ctrl");

  const [editName, setEditName] = useState(templateName);
  const [editSubject, setEditSubject] = useState(templateSubject);
  const [editLocale, setEditLocale] = useState(templateLocale);
  const [editPreheader, setEditPreheader] = useState(templatePreheader);

  useEffect(() => {
    setEditName(templateName);
    setEditSubject(templateSubject);
    setEditLocale(templateLocale);
    setEditPreheader(templatePreheader);
  }, [templateName, templateSubject, templateLocale, templatePreheader]);

  useEffect(() => {
    setShortcutModifier(getKeyboardShortcutModifier());
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.defaultPrevented || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setIsShortcutsOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute canUndo/canRedo directly from history arrays
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  const handleUndoClick = () => {
    undo();
  };

  const handleRedoClick = () => {
    redo();
  };

  const handleSaveClick = async () => {
    if (!onSave || !templateId) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      const options = {
        baseUrl,
        preheader: templatePreheader,
        title: templateSubject,
      };
      const html = renderEmailDesign(design, options);
      // The server action reports failure by returning { success: false }
      // instead of throwing, so the result has to be checked. Clearing isDirty
      // on a failed save loses the work: it also disarms the unload guard.
      const result = await onSave(templateId, design, html, {
        name: templateName,
        subject: templateSubject,
        locale: templateLocale,
        preheader: templatePreheader,
      });

      if (result && result.success === false) {
        setSaveError(
          result.error || "Could not save the template. Your changes are still here.",
        );
        return;
      }

      setDirty(false);
    } catch (error) {
      console.error("Save failed:", error);
      setSaveError("Could not save the template. Your changes are still here.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSave || !templateId) return;

    setIsSaving(true);
    setSettingsError(null);
    try {
      const options = {
        baseUrl,
        preheader: editPreheader,
        title: editSubject,
      };
      const html = renderEmailDesign(design, options);
      const result = await onSave(templateId, design, html, {
        name: editName,
        subject: editSubject,
        locale: editLocale,
        preheader: editPreheader,
      });

      if (result && result.success === false) {
        setSettingsError("Could not save the template info. Please try again.");
        return;
      }

      setTemplateMetadata(editName, editSubject, editLocale, editPreheader);
      setIsSettingsOpen(false);
      // We don't need to setDirty(true) here since we just saved to server
    } catch (error) {
      console.error("Failed to update template info:", error);
      setSettingsError("Could not save the template info. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.content}>
        {leave && (
          <button
            className={styles.backButton}
            onClick={() => leave("back")}
            title="Go back"
          >
            <ArrowLeft size={22} />
          </button>
        )}

        <h1 className={styles.title}>
          <strong>{templateName || "Untitled Template"}</strong>
          {isDirty && (
            <span className={styles.dirtyMarker} title="Unsaved changes">
              *
            </span>
          )}
        </h1>

        {saveError && (
          <p className={styles.saveError} role="alert">
            {saveError}
          </p>
        )}

        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsShortcutsOpen(true)}
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard size={16} />
          </Button>

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
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        disableAnimation={true}
        title="Keyboard Shortcuts"
        description="Use these shortcuts while the editor canvas is focused. Press Escape to close this dialog."
      >
        <div className="space-y-5">
          {(["Editing", "Selection", "History"] as const).map((group) => (
            <section key={group} className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-900">{group}</h3>
              <dl className="space-y-2">
                {KEYBOARD_SHORTCUTS.filter((shortcut) => shortcut.group === group).map(
                  (shortcut) => (
                    <div
                      key={shortcut.label}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <dt className="text-zinc-600">{shortcut.label}</dt>
                      <dd>
                        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-800 whitespace-nowrap">
                          {shortcutModifier === "⌘" ? shortcut.mac : shortcut.other}
                        </kbd>
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </section>
          ))}
        </div>
      </Dialog>

      <Dialog
        isOpen={isSettingsOpen}
        onClose={() => {
          setSettingsError(null);
          setIsSettingsOpen(false);
        }}
        disableAnimation={true}
        title="Template Info"
        description="Update the template name and email subject line."
      >
        <form onSubmit={handleSettingsSave} className="space-y-4">
          {settingsError && (
            <p className={styles.dialogError} role="alert">
              {settingsError}
            </p>
          )}

          <FormField
            label="Template Name"
            required
            hint="Internal name for this template"
          >
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Welcome Email"
              required
            />
          </FormField>

          <FormField
            label="Email Subject"
            required
            hint="The subject line recipients will see"
          >
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="e.g. Welcome to our community!"
              required
            />
          </FormField>

          <FormField
            label="Preview Text"
            hint="Shown next to the subject line in the inbox. Without it, clients fall back to the first words of the email."
          >
            <Input
              value={editPreheader}
              onChange={(e) => setEditPreheader(e.target.value)}
              placeholder="e.g. Your order is on its way"
              maxLength={150}
            />
          </FormField>

          <FormField
            label="Locale"
            required
            hint="Template language (e.g. en, ru, es)"
          >
            <Input
              value={editLocale}
              onChange={(e) => setEditLocale(e.target.value)}
              placeholder="en"
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
