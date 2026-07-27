"use client";

import React, { useState, useRef, useEffect } from "react";
import { STANDARD_MERGE_TAGS, MergeTag } from "@senlo/core";
import { useEditorStore } from "../../../state/editor.store";
import { Button } from "@senlo/ui";
import { Variable, ChevronDown } from "lucide-react";
import styles from "./merge-tag-selector.module.css";

interface MergeTagSelectorProps {
  onSelect: (tagValue: string) => void;
  label?: string;
}

export const MergeTagSelector = ({
  onSelect,
  label = "Personalize",
}: MergeTagSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const customMergeTags = useEditorStore((s) => s.customMergeTags);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (tag: MergeTag) => {
    onSelect(tag.value);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Variable size={14} className="mr-2" />
        {label}
        <ChevronDown size={14} className="ml-2 opacity-50" />
      </Button>

      {isOpen && (
        <div className={styles.dropdown}>
          {customMergeTags.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Trigger Specific</div>
              {customMergeTags.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  className={styles.item}
                  onClick={() => handleSelect(tag)}
                >
                  <span className={styles.itemLabel}>{tag.label}</span>
                  <span className={styles.itemValue}>{tag.value}</span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Contact</div>
            {STANDARD_MERGE_TAGS.filter((t) => t.category === "contact").map(
              (tag) => (
                <button
                  key={tag.value}
                  type="button"
                  className={styles.item}
                  onClick={() => handleSelect(tag)}
                >
                  <span className={styles.itemLabel}>{tag.label}</span>
                  <span className={styles.itemValue}>{tag.value}</span>
                </button>
              ),
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>System</div>
            {STANDARD_MERGE_TAGS.filter((t) => t.category !== "contact").map(
              (tag) => (
                <button
                  key={tag.value}
                  type="button"
                  className={styles.item}
                  onClick={() => handleSelect(tag)}
                >
                  <span className={styles.itemLabel}>{tag.label}</span>
                  <span className={styles.itemValue}>{tag.value}</span>
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
};
