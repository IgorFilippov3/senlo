"use client";

import { useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { Button, EmptyState } from "@senlo/ui";
import styles from "./ai-section.module.css";
import { useEditorStore } from "../../../../state/editor.store";

export const AiSection = () => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAiProvider = useEditorStore((s) => s.hasAiProvider);
  const projectId = useEditorStore((s) => s.projectId);
  const design = useEditorStore((s) => s.design);
  const setDesign = useEditorStore((s) => s.setDesign);
  const updateDesignFromAi = useEditorStore((s) => s.updateDesignFromAi);
  const setIsAiGenerating = useEditorStore((s) => s.setIsAiGenerating);

  const isEditing = design.rows.length > 0;

  if (!hasAiProvider) {
    return (
      <div className={styles.aiSection}>
        <div className={styles.title}>AI Assistant</div>
        <EmptyState
          icon={<Bot size={40} className="text-zinc-300" />}
          title="AI not configured"
          description="To enable AI template generation and editing, please connect an AI provider in your project settings."
          className="border-dashed border-2 py-10"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = `/projects/${projectId}`)}
            >
              Configure Project
            </Button>
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
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          projectId,
          currentDesign: isEditing ? design : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate template");
      }

      if (data.design) {
        if (isEditing) {
          updateDesignFromAi(data.design);
        } else {
          setDesign(data.design);
        }
        setPrompt("");
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
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
