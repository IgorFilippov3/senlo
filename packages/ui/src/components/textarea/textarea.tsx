import React from "react";
import { cn } from "../../lib/cn";
import styles from "./textarea.module.css";
import TextareaAutosize, { TextareaAutosizeProps } from "react-textarea-autosize";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    Pick<TextareaAutosizeProps, "maxRows" | "minRows" | "onHeightChange"> {}

/**
 * An auto-resizing textarea component.
 * Automatically adjusts height based on content.
 *
 * @example
 * ```tsx
 * <Textarea
 *   placeholder="Enter description..."
 *   minRows={3}
 *   maxRows={10}
 * />
 * ```
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <TextareaAutosize
        ref={ref as any}
        className={cn(styles.textarea, className)}
        style={style as any}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
