"use client";

import React, { memo } from "react";
import { useBlockForm } from "../../../../hooks/use-block-form";
import { dividerSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  ToggleGroup,
  ColorPicker,
  PaddingControl,
  FormGrid,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from "@senlo/ui";
import { DividerBlock } from "@senlo/core";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Controller } from "react-hook-form";
import {
  DEFAULT_DIVIDER_COLOR,
  DEFAULT_DIVIDER_WIDTH,
  DEFAULT_DIVIDER_ALIGN,
  DEFAULT_DIVIDER_BORDER_WIDTH,
  DEFAULT_DIVIDER_BORDER_STYLE,
  DEFAULT_DIVIDER_PADDING,
} from "./defaults/divider";

interface DividerSectionProps {
  block: DividerBlock;
}

export const DividerSection = memo(({ block }: DividerSectionProps) => {
  const { control, errors } = useBlockForm({
    block,
    schema: dividerSchema,
  });

  const alignOptions = [
    { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
    { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
    { value: "right", icon: <AlignRight size={16} />, label: "Right" },
  ];

  return (
    <FormSection title="Divider Settings">
      <FormGrid cols={2}>
        <FormField label="Line Color" error={errors.color?.message as string}>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <ColorPicker
                value={field.value ?? DEFAULT_DIVIDER_COLOR}
                onChange={field.onChange}
                defaultValue={DEFAULT_DIVIDER_COLOR}
              />
            )}
          />
        </FormField>

        <FormField label="Alignment" error={errors.align?.message as string}>
          <Controller
            name="align"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value ?? DEFAULT_DIVIDER_ALIGN}
                options={alignOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </FormGrid>

      <Controller
        name="width"
        control={control}
        render={({ field }) => (
          <Slider
            label="Width"
            unit="%"
            min={1}
            max={100}
            value={field.value ?? DEFAULT_DIVIDER_WIDTH}
            onChange={field.onChange}
          />
        )}
      />

      <FormGrid cols={2}>
        <FormField
          label="Line Thickness"
          error={errors.borderWidth?.message as string}
        >
          <Controller
            name="borderWidth"
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value ?? DEFAULT_DIVIDER_BORDER_WIDTH)}
                onValueChange={(val) => field.onChange(parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Thickness" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 8, 10].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {v}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          label="Line Style"
          error={errors.borderStyle?.message as string}
        >
          <Controller
            name="borderStyle"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? DEFAULT_DIVIDER_BORDER_STYLE}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                  <SelectItem value="dotted">Dotted</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </FormGrid>

      <FormSection title="Spacing">
        <Controller
          name="padding"
          control={control}
          render={({ field }) => (
            <PaddingControl
              value={field.value ?? DEFAULT_DIVIDER_PADDING}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>
    </FormSection>
  );
});
