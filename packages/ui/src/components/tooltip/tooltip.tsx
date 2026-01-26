"use client";

import React, { ReactNode } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import styles from "./tooltip.module.css";

export interface TooltipProps {
  /** The element that triggers the tooltip */
  children: ReactNode;
  /** The content to display inside the tooltip */
  content: ReactNode;
  /** Delay before showing the tooltip (ms) */
  delay?: number;
  /** Additional CSS class for the tooltip trigger container */
  className?: string;
  /** Which side of the trigger element to show the tooltip on */
  side?: "top" | "bottom" | "left" | "right";
  /** The distance from the trigger */
  sideOffset?: number;
}

/**
 * A professional tooltip component powered by Radix UI.
 * Uses Portals to prevent clipping by parent containers with overflow.
 */
export const Tooltip = ({
  children,
  content,
  delay = 300,
  className,
  side = "top",
  sideOffset = 5,
}: TooltipProps) => {
  return (
    <RadixTooltip.Provider delayDuration={delay}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild className={className}>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={sideOffset}
            className={styles.tooltip}
          >
            {content}
            <RadixTooltip.Arrow className={styles.arrow} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};
