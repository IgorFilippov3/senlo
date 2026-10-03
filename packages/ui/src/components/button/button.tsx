import React from "react";
import { cn } from "../../lib/cn";

import "./button.css";

/** Available button style variants */
export type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

/**
 * Available button sizes.
 *
 * This is the only way to size a button. The package ships plain, unlayered
 * CSS and Tailwind's utilities live in `@layer utilities`, so unlayered rules
 * win: `className="h-7 w-7 p-1"` silently loses its padding to `.sl-btn` and
 * the icon inside gets squeezed to nothing. `icon` and `icon-sm` are square
 * buttons for a single icon.
 */
export type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The visual style variant of the button */
  variant?: ButtonVariant;
  /** The size of the button */
  size?: ButtonSize;
}

/**
 * A versatile button component with multiple variants and sizes.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg">
 *   Click me
 * </Button>
 * ```
 *
 * @example
 * ```tsx
 * <Button variant="destructive" onClick={handleDelete}>
 *   Delete
 * </Button>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        type={type}
        ref={ref}
        className={cn(
          "sl-btn",
          `sl-btn--${variant}`,
          `sl-btn--${size}`,
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
