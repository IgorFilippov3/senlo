"use client";

import { useBlockForm } from "../../../../hooks/use-block-form";
import { headingSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  Textarea,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  FormGrid,
  ToggleGroup,
  ColorPicker,
  Slider,
  PaddingControl,
} from "@senlo/ui";
import { HeadingBlock } from "@senlo/core";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AArrowUp,
  AArrowDown,
} from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { MergeTagSelector } from "../merge-tag-selector";
import { validateHTML } from "@senlo/core";
import { HTMLValidationMessage } from "./html-validation-message";
import { useMemo, useState } from "react";
import {
  DEFAULT_HEADING_FONT_SIZES,
  DEFAULT_HEADING_FONT_WEIGHT,
  DEFAULT_HEADING_LINE_HEIGHT,
  DEFAULT_HEADING_LETTER_SPACING,
} from "./defaults/heading";
import { DEFAULT_PADDING, DEFAULT_COLOR } from "./defaults/common";
import {
  TextareaExpandedModal,
  ExpandButton,
} from "../textarea-expanded-modal";

interface HeadingSectionProps {
  block: HeadingBlock;
}

export const HeadingSection = ({ block }: HeadingSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { register, control, errors, setValue, getValues } = useBlockForm({
    block,
    schema: headingSchema,
  });

  const handleInsertTag = (
    tag: string,
    fieldName: "text" | "href" = "text",
  ) => {
    const currentVal = getValues(fieldName) || "";
    setValue(fieldName, currentVal + tag);
  };

  // Watch the level to determine default font size
  const level = useWatch({ control, name: "level" }) || block.data.level || 2;
  const textValue = useWatch({ control, name: "text" });
  const htmlErrors = useMemo(() => validateHTML(textValue || ""), [textValue]);

  const alignOptions = [
    { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
    { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
    { value: "right", icon: <AlignRight size={16} />, label: "Right" },
  ];

  const transformOptions = [
    { value: "none", icon: <AArrowDown size={16} />, label: "Normal" },
    { value: "uppercase", icon: <AArrowUp size={16} />, label: "All Caps" },
  ];

  // Get defaults from centralized constants
  const defaultFontSize =
    DEFAULT_HEADING_FONT_SIZES[level] || DEFAULT_HEADING_FONT_SIZES[2];
  const defaultFontWeight = DEFAULT_HEADING_FONT_WEIGHT;
  const defaultLineHeight = DEFAULT_HEADING_LINE_HEIGHT;
  const defaultLetterSpacing = DEFAULT_HEADING_LETTER_SPACING;
  const defaultPadding = DEFAULT_PADDING;

  return (
    <FormSection title="Heading Settings">
      <FormField
        label="Text"
        error={errors.text?.message as string}
        headerAction={<MergeTagSelector onSelect={handleInsertTag} />}
      >
        <Textarea {...register("text")} placeholder="Enter heading text..." />
        <ExpandButton onClick={() => setIsExpanded(true)} />
        <HTMLValidationMessage errors={htmlErrors} />
      </FormField>

      <TextareaExpandedModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        value={textValue || ""}
        onChange={(val) => setValue("text", val)}
        onInsertTag={(tag) => handleInsertTag(tag, "text")}
        title="Edit Heading"
      />

      <FormField
        label="Link URL"
        error={errors.href?.message as string}
        headerAction={
          <MergeTagSelector onSelect={(tag) => handleInsertTag(tag, "href")} />
        }
      >
        <Input {...register("href")} placeholder="https://example.com" />
      </FormField>

      <FormGrid cols={2}>
        <FormField label="Text Color" error={errors.color?.message as string}>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <ColorPicker
                value={field.value}
                onChange={field.onChange}
                defaultValue={DEFAULT_COLOR}
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
                value={field.value}
                options={alignOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </FormGrid>

      <FormGrid cols={2}>
        <FormField label="Text Transform">
          <Controller
            name="textTransform"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value || "none"}
                options={transformOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </FormGrid>

      <FormGrid cols={2}>
        <FormField label="Level" error={errors.level?.message as string}>
          <Controller
            name="level"
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value)}
                onValueChange={(val) => field.onChange(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1</SelectItem>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          label="Font Weight"
          error={errors.fontWeight?.message as string}
        >
          <Controller
            name="fontWeight"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? defaultFontWeight}
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
        name="fontSize"
        control={control}
        render={({ field }) => (
          <Slider
            label="Font Size"
            unit="px"
            min={12}
            max={72}
            value={field.value ?? defaultFontSize}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        name="lineHeight"
        control={control}
        render={({ field }) => (
          <Slider
            label="Line Height"
            min={1}
            max={3}
            step={0.1}
            value={field.value ?? defaultLineHeight}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        name="letterSpacing"
        control={control}
        render={({ field }) => (
          <Slider
            label="Letter Spacing"
            unit="px"
            min={-2}
            max={10}
            step={0.5}
            value={field.value ?? defaultLetterSpacing}
            onChange={field.onChange}
          />
        )}
      />

      <FormSection title="Spacing">
        <Controller
          name="padding"
          control={control}
          render={({ field }) => (
            <PaddingControl
              value={field.value ?? defaultPadding}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>
    </FormSection>
  );
};
