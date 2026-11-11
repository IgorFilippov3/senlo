"use client";

import React, { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import styles from "./dialog.module.css";

export interface DialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog should close */
  onClose: () => void;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
  /** Dialog body content */
  children: React.ReactNode;
  /** Footer content (usually action buttons) */
  footer?: React.ReactNode;
  /** Additional CSS class for the dialog content */
  className?: string;
  /** Whether to disable opening animations */
  disableAnimation?: boolean;
  /**
   * Maximum width: `default` 500px, `lg` 768px, `xl` 1024px. Use this rather
   * than a `max-w-*` class, which the dialog's own rule overrides.
   */
  size?: "default" | "lg" | "xl";
}

/**
 * A modal dialog component with backdrop overlay.
 * Supports keyboard navigation (Escape to close) and click outside to close.
 *
 * @example
 * ```tsx
 * <Dialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Delete"
 *   description="Are you sure you want to delete this item?"
 *   footer={
 *     <>
 *       <Button variant="outline" onClick={() => setIsOpen(false)}>
 *         Cancel
 *       </Button>
 *       <Button variant="destructive" onClick={handleDelete}>
 *         Delete
 *       </Button>
 *     </>
 *   }
 * >
 *   <p>This action cannot be undone.</p>
 * </Dialog>
 * ```
 */
export const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  (
    {
      isOpen,
      onClose,
      title,
      description,
      children,
      footer,
      className,
      disableAnimation,
      size = "default",
    },
    ref,
  ) => {
    const handleEscape = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      },
      [onClose],
    );

    useEffect(() => {
      if (isOpen) {
        document.addEventListener("keydown", handleEscape);
        document.body.style.overflow = "hidden";
      } else {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "unset";
      }

      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "unset";
      };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    return createPortal(
      <div
        className={cn(styles.overlay, disableAnimation && styles.noAnimation)}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          ref={ref}
          className={cn(
            styles.content,
            size === "lg" && styles.sizeLg,
            size === "xl" && styles.sizeXl,
            className,
            disableAnimation && styles.noAnimation,
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "dialog-title" : undefined}
          aria-describedby={description ? "dialog-description" : undefined}
        >
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>

          {(title || description) && (
            <div className={styles.header}>
              {title && (
                <h2 id="dialog-title" className={styles.title}>
                  {title}
                </h2>
              )}
              {description && (
                <p id="dialog-description" className={styles.description}>
                  {description}
                </p>
              )}
            </div>
          )}

          <div className={styles.body}>{children}</div>

          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </div>,
      document.body,
    );
  },
);

Dialog.displayName = "Dialog";
