import React from "react";
import { cn } from "../../lib/cn";
import styles from "./page-header.module.css";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** The page title */
  title?: string;
  /** Optional description text below the title */
  description?: string;
  /** Action buttons (e.g., Create, Export) */
  actions?: React.ReactNode;
}

/**
 * A page header component with title, description, and action buttons.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Projects"
 *   description="Manage your email projects"
 *   actions={<Button>Create Project</Button>}
 * />
 * ```
 */
export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  ({ title, description, actions, className, ...props }, ref) => {
    return (
      <header ref={ref} className={cn(styles.header, className)} {...props}>
        {(title || description) && (
          <div className={styles.content}>
            {title && <h1 className={styles.title}>{title}</h1>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
        )}
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
    );
  },
);

PageHeader.displayName = "PageHeader";
