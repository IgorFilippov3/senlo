"use client";

import { useBlockForm } from "../../../../hooks/use-block-form";
import { paragraphSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  Textarea,
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
  Input,
} from "@senlo/ui";
import { ParagraphBlock } from "@senlo/core";
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
  DEFAULT_PARAGRAPH_FONT_SIZE,
  DEFAULT_PARAGRAPH_LINE_HEIGHT,
  DEFAULT_PARAGRAPH_FONT_WEIGHT,
  DEFAULT_PARAGRAPH_LETTER_SPACING,
} from "./defaults/paragraph";
import { DEFAULT_PADDING, DEFAULT_COLOR } from "./defaults/common";
import {
  TextareaExpandedModal,
  ExpandButton,
} from "../textarea-expanded-modal";

interface ParagraphSectionProps {
  block: ParagraphBlock;
}

export const ParagraphSection = ({ block }: ParagraphSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { register, control, errors, setValue, getValues } = useBlockForm({
    block,
    schema: paragraphSchema,
  });

  const textValue = useWatch({ control, name: "text" });
  const htmlErrors = useMemo(() => validateHTML(textValue || ""), [textValue]);

  const handleInsertTag = (
    tag: string,
    fieldName: "text" | "href" = "text",
  ) => {
    const currentVal = getValues(fieldName) || "";
    setValue(fieldName, currentVal + tag);
  };

  const alignOptions = [
    { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
    { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
    { value: "right", icon: <AlignRight size={16} />, label: "Right" },
  ];

  const transformOptions = [
    { value: "none", icon: <AArrowDown size={16} />, label: "Normal" },
    { value: "uppercase", icon: <AArrowUp size={16} />, label: "All Caps" },
  ];

  return (
    <FormSection title="Paragraph Settings">
      <FormField
        label="Text"
        error={errors.text?.message as string}
        headerAction={<MergeTagSelector onSelect={handleInsertTag} />}
      >
        <Textarea
          {...register("text")}
          placeholder="Enter paragraph text..."
          minRows={2}
        />
        <ExpandButton onClick={() => setIsExpanded(true)} />
        <HTMLValidationMessage errors={htmlErrors} />
      </FormField>

      <TextareaExpandedModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        value={textValue || ""}
        onChange={(val) => setValue("text", val)}
        onInsertTag={(tag) => handleInsertTag(tag, "text")}
        title="Edit Paragraph"
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

        <FormField
          label="Font Weight"
          error={errors.fontWeight?.message as string}
        >
          <Controller
            name="fontWeight"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? DEFAULT_PARAGRAPH_FONT_WEIGHT}
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
            value={field.value ?? DEFAULT_PARAGRAPH_FONT_SIZE}
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
            value={field.value ?? DEFAULT_PARAGRAPH_LINE_HEIGHT}
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
            value={field.value ?? DEFAULT_PARAGRAPH_LETTER_SPACING}
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
              value={field.value ?? DEFAULT_PADDING}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>
    </FormSection>
  );
};
