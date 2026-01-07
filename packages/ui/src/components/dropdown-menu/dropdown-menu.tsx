"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/cn";

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
          className={cn(
            // Base styles
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 shadow-md",
            // Animation
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
        >
          {items.map((item, index) => (
            <DropdownMenuPrimitive.Item
              key={index}
              className={cn(
                "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-zinc-100 focus:text-zinc-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                item.className
              )}
              onClick={item.onClick}
              disabled={item.disabled}
            >
              {item.icon && (
                <span className="flex h-4 w-4 items-center justify-center">
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