"use client";

import { useBlockForm } from "../../../../hooks/use-block-form";
import { productLineSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  Textarea,
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
import { ProductLineBlock } from "@senlo/core";
import { Controller, useWatch } from "react-hook-form";
import { MergeTagSelector } from "../merge-tag-selector";
import { validateHTML } from "@senlo/core";
import { HTMLValidationMessage } from "./html-validation-message";
import {
  TextareaExpandedModal,
  ExpandButton,
} from "../textarea-expanded-modal";
import { useMemo, useState } from "react";
import {
  DEFAULT_PRODUCT_LINE_LEFT_TEXT,
  DEFAULT_PRODUCT_LINE_RIGHT_TEXT,
  DEFAULT_PRODUCT_LINE_LEFT_STYLE,
  DEFAULT_PRODUCT_LINE_RIGHT_STYLE,
  DEFAULT_PRODUCT_LINE_RIGHT_WIDTH,
  DEFAULT_PRODUCT_LINE_PADDING,
} from "./defaults/product-line";

interface ProductLineSectionProps {
  block: ProductLineBlock;
}

export const ProductLineSection = ({ block }: ProductLineSectionProps) => {
  const [isLeftExpanded, setIsLeftExpanded] = useState(false);
  const [isRightExpanded, setIsRightExpanded] = useState(false);

  const { register, control, errors, setValue, getValues } = useBlockForm({
    block,
    schema: productLineSchema,
  });

  const leftTextValue = useWatch({ control, name: "leftText" });
  const rightTextValue = useWatch({ control, name: "rightText" });
  const leftHtmlErrors = useMemo(
    () => validateHTML(leftTextValue || ""),
    [leftTextValue],
  );
  const rightHtmlErrors = useMemo(
    () => validateHTML(rightTextValue || ""),
    [rightTextValue],
  );

  const handleInsertTag = (
    tag: string,
    fieldName: "leftText" | "rightText" = "leftText",
  ) => {
    const currentVal = getValues(fieldName) || "";
    setValue(fieldName, currentVal + tag);
  };

  return (
    <FormSection title="Product Line Settings">
      <FormField
        label="Left Text"
        error={errors.leftText?.message as string}
        headerAction={
          <MergeTagSelector
            onSelect={(tag) => handleInsertTag(tag, "leftText")}
          />
        }
      >
        <Textarea
          {...register("leftText")}
          placeholder={DEFAULT_PRODUCT_LINE_LEFT_TEXT}
          minRows={1}
        />
        <ExpandButton onClick={() => setIsLeftExpanded(true)} />
        <HTMLValidationMessage errors={leftHtmlErrors} />
      </FormField>

      <TextareaExpandedModal
        isOpen={isLeftExpanded}
        onClose={() => setIsLeftExpanded(false)}
        value={leftTextValue || ""}
        onChange={(val) => setValue("leftText", val)}
        onInsertTag={(tag) => handleInsertTag(tag, "leftText")}
        title="Edit Left Text"
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

      <FormField
        label="Right Text"
        error={errors.rightText?.message as string}
        headerAction={
          <MergeTagSelector
            onSelect={(tag) => handleInsertTag(tag, "rightText")}
          />
        }
      >
        <Textarea
          {...register("rightText")}
          placeholder={DEFAULT_PRODUCT_LINE_RIGHT_TEXT}
          minRows={1}
        />
        <ExpandButton onClick={() => setIsRightExpanded(true)} />
        <HTMLValidationMessage errors={rightHtmlErrors} />
      </FormField>

      <TextareaExpandedModal
        isOpen={isRightExpanded}
        onClose={() => setIsRightExpanded(false)}
        value={rightTextValue || ""}
        onChange={(val) => setValue("rightText", val)}
        onInsertTag={(tag) => handleInsertTag(tag, "rightText")}
        title="Edit Right Text"
      />

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
    </FormSection>
  );
};
