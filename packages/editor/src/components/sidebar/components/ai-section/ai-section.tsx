"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Button, EmptyState } from "@senlo/ui";
import styles from "./ai-section.module.css";
import { useEditorStore } from "../../../../state/editor.store";
import { useEditorHost } from "../../../../host";
import { useLeaveEditor } from "../../../../hooks/use-leave-editor";

export const AiSection = () => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasAiProvider, generateWithAi } = useEditorHost();
  const leave = useLeaveEditor();
  const design = useEditorStore((s) => s.design);
  const setDesign = useEditorStore((s) => s.setDesign);
  const updateDesignFromAi = useEditorStore((s) => s.updateDesignFromAi);
  const setIsAiGenerating = useEditorStore((s) => s.setIsAiGenerating);

  const isEditing = design.rows.length > 0;

  if (!hasAiProvider || !generateWithAi) {
    return (
      <div className={styles.aiSection}>
        <div className={styles.title}>AI Assistant</div>
        <EmptyState
          icon={<Bot size={40} className="text-zinc-300" />}
          title="AI not configured"
          description="To enable AI template generation and editing, please connect an AI provider in your workspace settings."
          className="border-dashed border-2 py-10"
          action={
            leave && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => leave("ai-settings")}
              >
                Configure Workspace
              </Button>
            )
          }
        />
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setIsAiGenerating(true);
    setError(null);

    try {
      const generated = await generateWithAi({
        prompt,
        currentDesign: isEditing ? design : undefined,
      });

      if (isEditing) {
        updateDesignFromAi(generated);
      } else {
        setDesign(generated);
      }
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
      setIsAiGenerating(false);
    }
  };

  return (
    <div className={styles.aiSection}>
      <div className={styles.title}>
        {isEditing ? "AI Editor" : "AI Generator"}
      </div>
      <p
        style={{
          fontSize: "var(--sl-font-size-xs)",
          color: "var(--sl-color-text-secondary)",
          marginBottom: "8px",
        }}
      >
        {isEditing
          ? "Describe what you want to change in your email, and AI will update the design."
          : "Describe your email, and AI will build the structure using available blocks."}
      </p>
      <textarea
        className={styles.textarea}
        placeholder={
          isEditing
            ? "e.g. Change all buttons to green, or add a footer with social links..."
            : "e.g. A welcome email for a SaaS product with a hero image, greeting, list of features and a get started button..."
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={isLoading}
      />
      <button
        className={styles.button}
        onClick={handleGenerate}
        disabled={isLoading || !prompt.trim()}
      >
        {isLoading
          ? isEditing
            ? "Updating..."
            : "Generating..."
          : isEditing
            ? "Update Template"
            : "Generate Template"}
      </button>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};
