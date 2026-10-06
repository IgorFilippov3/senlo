"use client";

import React from "react";
import {
  BorderControl,
  ColorPicker,
  FormField,
  FormGrid,
  FormSection,
  PaddingControl,
  Slider,
  ToggleGroup,
} from "@senlo/ui";
import { Controller } from "react-hook-form";
import { Minus, MoreHorizontal, Square } from "lucide-react";

import { DEFAULT_BOX } from "./defaults/common";

interface BoxSectionProps {
  control: any;
  /** Hints default to a block's wording; a column passes its own. */
  backgroundHint?: string;
  marginHint?: string;
}

const borderStyleOptions = [
  {
    value: "solid",
    icon: <Square size={16} fill="currentColor" fillOpacity={0.2} />,
    label: "Solid",
  },
  { value: "dashed", icon: <MoreHorizontal size={16} />, label: "Dashed" },
  {
    value: "dotted",
    icon: <Minus size={16} style={{ transform: "rotate(90deg)" }} />,
    label: "Dotted",
  },
];

/**
 * The card styling every text block shares: a background, a border, rounded
 * corners and the gap to the blocks around it.
 *
 * One component for all of them, because the fields come from one place in
 * `@senlo/core` (`boxFields`) and a block that renders them differently would
 * be a bug rather than a variation.
 *
 * "Outer spacing" is the gap outside the background; the block's own padding,
 * edited in its own section, is the space inside it.
 */
export const BoxSection = ({
  control,
  backgroundHint = "Leave it unset for a block with no background of its own.",
  marginHint = "The gap around the block, outside its background. The space inside it is the block's own padding, under Spacing.",
}: BoxSectionProps) => {
  return (
    <FormSection title="Background & Border">
      <FormField
        label="Background"
        hint={backgroundHint}
      >
        <Controller
          name="backgroundColor"
          control={control}
          render={({ field }) => (
            <ColorPicker
              value={field.value}
              onChange={field.onChange}
              defaultValue="transparent"
            />
          )}
        />
      </FormField>

      <FormGrid cols={2}>
        <FormField label="Border Style">
          <Controller
            name="border.style"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value || DEFAULT_BOX.border.style}
                options={borderStyleOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField label="Border Color">
          <Controller
            name="border.color"
            control={control}
            render={({ field }) => (
              <ColorPicker
                value={field.value}
                onChange={field.onChange}
                defaultValue={DEFAULT_BOX.border.color}
              />
            )}
          />
        </FormField>
      </FormGrid>

      <Controller
        name="border"
        control={control}
        render={({ field }) => (
          <BorderControl
            value={field.value}
            onChange={(val) => field.onChange({ ...field.value, ...val })}
          />
        )}
      />

      <Controller
        name="borderRadius"
        control={control}
        render={({ field }) => (
          <Slider
            label="Corner Radius"
            unit="px"
            min={0}
            max={40}
            value={field.value ?? DEFAULT_BOX.borderRadius}
            onChange={field.onChange}
          />
        )}
      />

      <FormField hint={marginHint}>
        <Controller
          name="margin"
          control={control}
          render={({ field }) => (
            <PaddingControl
              title="Outer spacing"
              value={field.value ?? DEFAULT_BOX.margin}
              onChange={field.onChange}
            />
          )}
        />
      </FormField>
    </FormSection>
  );
};
