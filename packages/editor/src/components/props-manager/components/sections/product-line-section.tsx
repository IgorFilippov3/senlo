"use client";

import { useBlockForm } from "../../../../hooks/use-block-form";
import { productLineSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  ColorPicker,
  PaddingControl,
  FormGrid,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  ToggleGroup,
} from "@senlo/ui";
import { ProductLineBlock } from "@senlo/core";
import { Controller } from "react-hook-form";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  Minus,
  MoreHorizontal,
  Square,
} from "lucide-react";
import { ProductLineItems } from "./product-line-items";
import { BoxSection } from "./box-section";
import { ConditionSection } from "./condition-section";
import {
  DEFAULT_PRODUCT_LINE_LEFT_TEXT,
  DEFAULT_PRODUCT_LINE_RIGHT_TEXT,
  DEFAULT_PRODUCT_LINE_LEFT_STYLE,
  DEFAULT_PRODUCT_LINE_RIGHT_STYLE,
  DEFAULT_PRODUCT_LINE_RIGHT_WIDTH,
  DEFAULT_PRODUCT_LINE_LEFT_ALIGN,
  DEFAULT_PRODUCT_LINE_RIGHT_ALIGN,
  DEFAULT_PRODUCT_LINE_VERTICAL_ALIGN,
  DEFAULT_PRODUCT_LINE_PADDING,
  DEFAULT_PRODUCT_LINE_ROW_PADDING,
  DEFAULT_PRODUCT_LINE_DIVIDER,
} from "./defaults/product-line";

interface ProductLineSectionProps {
  block: ProductLineBlock;
}

export const ProductLineSection = ({ block }: ProductLineSectionProps) => {
  const { control, errors, setValue } = useBlockForm({
    block,
    schema: productLineSchema,
  });

  const items = block.data.items ?? [];

  const dividerStyleOptions = [
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

  const alignOptions = [
    { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
    { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
    { value: "right", icon: <AlignRight size={16} />, label: "Right" },
  ];

  const verticalAlignOptions = [
    { value: "top", icon: <AlignStartHorizontal size={16} />, label: "Top" },
    {
      value: "middle",
      icon: <AlignCenterHorizontal size={16} />,
      label: "Middle",
    },
    { value: "bottom", icon: <AlignEndHorizontal size={16} />, label: "Bottom" },
  ];

  return (
    <FormSection title="Product Line Settings">
      <ProductLineItems
        items={items}
        onChange={(next) => setValue("items", next)}
      />

      <FormSection title="Left Text Styling">
        <FormGrid cols={2}>
          <FormField
            label="Color"
            error={errors.leftStyle?.color?.message as string}
          >
            <Controller
              name="leftStyle.color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  defaultValue={DEFAULT_PRODUCT_LINE_LEFT_STYLE.color}
                />
              )}
            />
          </FormField>

          <FormField
            label="Font Weight"
            error={errors.leftStyle?.fontWeight?.message as string}
          >
            <Controller
              name="leftStyle.fontWeight"
              control={control}
              render={({ field }) => (
                <Select
                  value={
                    field.value ?? DEFAULT_PRODUCT_LINE_LEFT_STYLE.fontWeight
                  }
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Regular</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </FormGrid>

        <FormField
          label="Alignment"
          error={errors.leftAlign?.message as string}
        >
          <Controller
            name="leftAlign"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value ?? DEFAULT_PRODUCT_LINE_LEFT_ALIGN}
                options={alignOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <Controller
          name="leftStyle.fontSize"
          control={control}
          render={({ field }) => (
            <Slider
              label="Font Size"
              unit="px"
              min={12}
              max={72}
              value={field.value ?? DEFAULT_PRODUCT_LINE_LEFT_STYLE.fontSize}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="leftStyle.lineHeight"
          control={control}
          render={({ field }) => (
            <Slider
              label="Line Height"
              min={1}
              max={3}
              step={0.1}
              value={field.value ?? DEFAULT_PRODUCT_LINE_LEFT_STYLE.lineHeight}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <FormSection title="Right Text Styling">
        <FormGrid cols={2}>
          <FormField
            label="Color"
            error={errors.rightStyle?.color?.message as string}
          >
            <Controller
              name="rightStyle.color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  defaultValue={DEFAULT_PRODUCT_LINE_RIGHT_STYLE.color}
                />
              )}
            />
          </FormField>

          <FormField
            label="Font Weight"
            error={errors.rightStyle?.fontWeight?.message as string}
          >
            <Controller
              name="rightStyle.fontWeight"
              control={control}
              render={({ field }) => (
                <Select
                  value={
                    field.value ?? DEFAULT_PRODUCT_LINE_RIGHT_STYLE.fontWeight
                  }
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Regular</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </FormGrid>

        <FormField
          label="Alignment"
          error={errors.rightAlign?.message as string}
        >
          <Controller
            name="rightAlign"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value ?? DEFAULT_PRODUCT_LINE_RIGHT_ALIGN}
                options={alignOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <Controller
          name="rightStyle.fontSize"
          control={control}
          render={({ field }) => (
            <Slider
              label="Font Size"
              unit="px"
              min={12}
              max={72}
              value={field.value ?? DEFAULT_PRODUCT_LINE_RIGHT_STYLE.fontSize}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          name="rightStyle.lineHeight"
          control={control}
          render={({ field }) => (
            <Slider
              label="Line Height"
              min={1}
              max={3}
              step={0.1}
              value={field.value ?? DEFAULT_PRODUCT_LINE_RIGHT_STYLE.lineHeight}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <FormSection title="Layout">
        <Controller
          name="rightWidth"
          control={control}
          render={({ field }) => (
            <Slider
              label="Right Column Width"
              unit="px"
              min={60}
              max={300}
              value={field.value ?? DEFAULT_PRODUCT_LINE_RIGHT_WIDTH}
              onChange={field.onChange}
            />
          )}
        />

        <FormField
          label="Vertical Alignment"
          hint="Where the shorter side of a line sits when the other wraps."
          error={errors.verticalAlign?.message as string}
        >
          <Controller
            name="verticalAlign"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value ?? DEFAULT_PRODUCT_LINE_VERTICAL_ALIGN}
                options={verticalAlignOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title="Lines">
        <Controller
          name="divider.width"
          control={control}
          render={({ field }) => (
            <Slider
              label="Divider"
              unit="px"
              min={0}
              max={4}
              value={field.value ?? DEFAULT_PRODUCT_LINE_DIVIDER.width}
              onChange={field.onChange}
            />
          )}
        />

        <FormGrid cols={2}>
          <FormField label="Divider Style">
            <Controller
              name="divider.style"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  value={field.value || DEFAULT_PRODUCT_LINE_DIVIDER.style}
                  options={dividerStyleOptions}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Divider Color">
            <Controller
              name="divider.color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  defaultValue={DEFAULT_PRODUCT_LINE_DIVIDER.color}
                />
              )}
            />
          </FormField>
        </FormGrid>

        <FormField hint="The space inside each line, which is also what the divider clears.">
          <Controller
            name="rowPadding"
            control={control}
            render={({ field }) => (
              <PaddingControl
                title="Line padding"
                value={field.value ?? DEFAULT_PRODUCT_LINE_ROW_PADDING}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title="Spacing">
        <Controller
          name="padding"
          control={control}
          render={({ field }) => (
            <PaddingControl
              value={field.value ?? DEFAULT_PRODUCT_LINE_PADDING}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <BoxSection control={control} />

      <ConditionSection control={control} setValue={setValue} />
    </FormSection>
  );
};
