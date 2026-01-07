import React from "react";
import { cn } from "../../lib/cn";
import { Label } from "../label/label";
import styles from "./form-field.module.css";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The label text for the field */
  label?: string;
  /** Error message to display below the input */
  error?: string;
  /** Hint text to display when there's no error */
  hint?: string;
  /** Description text (alias for hint) */
  description?: string;
  /** Whether the field is required (shows asterisk) */
  required?: boolean;
  /** The form control (Input, Select, etc.) */
  children: React.ReactNode;
  /** Optional action element in the header (e.g., a link) */
  headerAction?: React.ReactNode;
}

/**
 * A form field wrapper with label, error, and hint support.
 * Provides consistent spacing and styling for form inputs.
 *
 * @example
 * ```tsx
 * <FormField label="Email" required error={errors.email}>
 *   <Input type="email" />
 * </FormField>
 * ```
 *
 * @example
 * ```tsx
 * <FormField label="Description" hint="Max 500 characters">
 *   <Textarea />
 * </FormField>
 * ```
 */
export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    { label, error, hint, description, required, className, children, headerAction, ...props },
    ref
  ) => {
    const hintText = hint || description;
    return (
      <div ref={ref} className={cn(styles.formField, className)} {...props}>
        {(label || headerAction) && (
          <div className={styles.header}>
            {label && (
              <Label>
                {label}
                {required && (
                  <span
                    style={{ color: "var(--sl-color-destructive)", marginLeft: "2px" }}
                    aria-hidden="true"
                  >
                    *
                  </span>
                )}
              </Label>
            )}
            {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
          </div>
        )}
        {children}
        {error && (
          <span className={styles.error} role="alert">
            {error}
          </span>
        )}
        {!error && hintText && <span className={styles.hint}>{hintText}</span>}
      </div>
    );
  }
);

FormField.displayName = "FormField";
