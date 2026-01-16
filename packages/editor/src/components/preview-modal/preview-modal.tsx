"use client";

import React, { useState, useMemo } from "react";
import { Dialog, ToggleGroup } from "@senlo/ui";
import { Monitor, Smartphone } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");

  const html = useMemo(() => {
    if (!isOpen) return "";
    
    const options: RenderOptions = {
      baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      data: {
        contact: previewContact || {},
        project: { name: "Sample Project" },
        campaign: { name: "Sample Campaign" },
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
        </div>
        
        <div className={styles.iframeWrapper}>
          <iframe
            title="Email Preview"
            className={cn(styles.iframe, styles[viewMode])}
            srcDoc={html}
          />
        </div>
      </div>
    </Dialog>
  );
};




