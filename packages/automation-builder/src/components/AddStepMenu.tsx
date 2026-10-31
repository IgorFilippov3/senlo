import React from "react";
import { DropdownMenu } from "@senlo/ui";
import { STEP_META } from "./nodes/stepMeta";

interface AddStepMenuProps {
  types: readonly string[];
  onSelect: (type: string) => void;
  /** The button that opens the menu. */
  children: React.ReactElement;
}

export const AddStepMenu = ({ types, onSelect, children }: AddStepMenuProps) => (
  <DropdownMenu
    align="center"
    side="bottom"
    trigger={children}
    items={types.map((type) => {
      const meta = STEP_META[type];
      const Icon = meta.icon;
      return {
        label: meta.kind,
        icon: <Icon size={14} className={meta.tone} />,
        onClick: () => onSelect(type),
      };
    })}
  />
);
