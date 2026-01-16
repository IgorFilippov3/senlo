"use client";

import React, { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { json } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import styles from "./json-editor.module.css";
import { cn } from "../../lib/cn";

export interface JsonEditorProps {
  /** JSON string value */
  value: string;
  /** Callback when content changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Editor height (default: "200px") */
  height?: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * A JSON editor component with syntax highlighting.
 * Based on CodeMirror 6.
 *
 * @example
 * ```tsx
 * <JsonEditor
 *   value={jsonString}
 *   onChange={setJsonString}
 *   height="300px"
 * />
 * ```
 */
const JsonEditorComponent = ({
  value,
  onChange,
  placeholder,
  height = "200px",
  className = "",
}: JsonEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        json(),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { height: height },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  // Sync value from outside if it changes (e.g. from a reset)
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div 
      ref={editorRef} 
      className={cn(styles.container, className)}
    />
  );
};

JsonEditorComponent.displayName = "JsonEditor";export const JsonEditor = JsonEditorComponent;