"use client";

import React, { useState } from "react";
import { Dialog } from "@senlo/ui";
import { Code, Copy, Check, FileCode } from "lucide-react";
import styles from "./export-modal.module.css";
import { renderEmailDesign, renderEmailDesignMJML } from "@senlo/core";
import { useEditorStore } from "../../state/editor.store";
import { cn } from "@senlo/ui";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal = ({ isOpen, onClose }: ExportModalProps) => {
  const design = useEditorStore((s) => s.design);
  const [copiedType, setCopiedType] = useState<"html" | "mjml" | null>(null);

  const handleCopy = async (type: "html" | "mjml") => {
    const options = { baseUrl: window.location.origin };
    const content = type === "html" 
      ? renderEmailDesign(design, options) 
      : renderEmailDesignMJML(design, options);

    try {
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Get the code"
      description="Export your email design as HTML or MJML code."
    >
      <div className={styles.container}>
        {/* HTML Export Item */}
        <div className={styles.exportItem}>
          <div className={styles.mainContent}>
            <div className={styles.icon}>
              <Code size={24} />
            </div>
            <span className={styles.label}>HTML code</span>
          </div>
          <button
            className={cn(styles.copyButton, copiedType === "html" && styles.copied)}
            onClick={() => handleCopy("html")}
            title="Copy HTML to clipboard"
          >
            {copiedType === "html" ? <Check size={24} /> : <Copy size={24} />}
          </button>
        </div>

        {/* MJML Export Item */}
        <div className={styles.exportItem}>
          <div className={styles.mainContent}>
            <div className={styles.icon}>
              <FileCode size={24} />
            </div>
            <span className={styles.label}>MJML code</span>
          </div>
          <button
            className={cn(styles.copyButton, copiedType === "mjml" && styles.copied)}
            onClick={() => handleCopy("mjml")}
            title="Copy MJML to clipboard"
          >
            {copiedType === "mjml" ? <Check size={24} /> : <Copy size={24} />}
          </button>
        </div>
      </div>
    </Dialog>
  );
};








