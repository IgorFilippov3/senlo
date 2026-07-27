"use client";

import React, { useState, useMemo } from "react";
import { Dialog, ToggleGroup, Button, JsonEditor } from "@senlo/ui";
import { Monitor, Smartphone, Database, X } from "lucide-react";
import { renderEmailDesign, RenderOptions } from "@senlo/core";
import { useEditorStore } from "../../state/editor.store";
import styles from "./preview-modal.module.css";
import { cn } from "@senlo/ui";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = "desktop" | "mobile";

export const PreviewModal = ({ isOpen, onClose }: PreviewModalProps) => {
  const design = useEditorStore((s) => s.design);
  const previewContact = useEditorStore((s) => s.previewContact);
  const setPreviewContact = useEditorStore((s) => s.setPreviewContact);
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [showMockData, setShowMockData] = useState(false);

  const [mockDataJson, setMockDataJson] = useState(() =>
    JSON.stringify(previewContact || {}, null, 2),
  );

  const handleMockDataChange = (val: string) => {
    setMockDataJson(val);
    try {
      const parsed = JSON.parse(val);
      setPreviewContact(parsed);
    } catch (e) {
      // Invalid JSON, don't update store yet
    }
  };

  const html = useMemo(() => {
    if (!isOpen) return "";

    const options: RenderOptions = {
      baseUrl:
        typeof window !== "undefined" ? window.location.origin : undefined,
      data: {
        contact: previewContact || {},
        custom: previewContact || {}, // Pass mock data as custom variables too
        workspace: { name: "Sample Workspace" },
        trigger: { name: "Sample Trigger" },
        unsubscribeUrl: "https://senlo.io/unsubscribe/sample-token",
      },
    };

    return renderEmailDesign(design, options);
  }, [design, isOpen, previewContact]);

  const viewOptions = [
    { value: "desktop", icon: <Monitor size={18} />, label: "Desktop" },
    { value: "mobile", icon: <Smartphone size={18} />, label: "Mobile" },
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Email Preview"
      description="See how your email looks on different devices."
      className={styles.dialogOverride}
    >
      <div className={styles.container}>
        <div className={styles.controls}>
          <ToggleGroup
            value={viewMode}
            options={viewOptions}
            onChange={(val) => setViewMode(val as ViewMode)}
          />
          <div className="flex-1" />
          <Button
            variant={showMockData ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowMockData(!showMockData)}
          >
            <Database size={16} className="mr-2" />
            Mock Data
          </Button>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden">
          <div className={cn(styles.iframeWrapper, "flex-1")}>
            <iframe
              title="Email Preview"
              className={cn(styles.iframe, styles[viewMode])}
              srcDoc={html}
            />
          </div>

          {showMockData && (
            <div className="w-80 flex flex-col border rounded-md bg-white overflow-hidden">
              <div className="p-2 border-bottom flex items-center justify-between bg-zinc-50">
                <span className="text-xs font-semibold uppercase text-zinc-500">
                  Mock Contact Data
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowMockData(false)}
                >
                  <X size={14} />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                <JsonEditor
                  value={mockDataJson}
                  onChange={handleMockDataChange}
                  height="100%"
                />
              </div>
              <div className="p-2 bg-zinc-50 text-[10px] text-zinc-400 border-t">
                Changes here will update the preview in real-time.
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
