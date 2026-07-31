"use client";

"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/cn";
import "./dropdown-menu.css";

interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

const DropdownMenu = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuProps
>(({ trigger, items, className, align = "end", side = "bottom" }, ref) => {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        {trigger}
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          align={align}
          side={side}
          sideOffset={4}
          className={cn("sl-dropdown-content", className)}
        >
          {items.map((item, index) => (
            <DropdownMenuPrimitive.Item
              key={index}
              className={cn("sl-dropdown-item", item.className)}
              onClick={item.onClick}
              disabled={item.disabled}
            >
              {item.icon && (
                <span className="sl-dropdown-item-icon">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
});

DropdownMenu.displayName = "DropdownMenu";

export { DropdownMenu };
export type { DropdownMenuItem, DropdownMenuProps };