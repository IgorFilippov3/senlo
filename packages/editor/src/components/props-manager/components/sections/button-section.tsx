"use client";

import { useBlockForm } from "../../../../hooks/use-block-form";
import { buttonSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  Input,
  Textarea,
  ToggleGroup,
  ColorPicker,
  FormGrid,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  PaddingControl,
} from "@senlo/ui";
import { ButtonBlock } from "@senlo/core";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Minimize2,
  Square,
  Minus,
  MoreHorizontal,
} from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { MergeTagSelector } from "../merge-tag-selector";
import { validateHTML } from "@senlo/core";
import { HTMLValidationMessage } from "./html-validation-message";
import { useMemo, useState } from "react";
import {
  DEFAULT_BUTTON_FONT_SIZE,
  DEFAULT_BUTTON_FONT_WEIGHT,
  DEFAULT_BUTTON_COLOR,
  DEFAULT_BUTTON_BG_COLOR,
  DEFAULT_BUTTON_BORDER_RADIUS,
  DEFAULT_BUTTON_PADDING,
  DEFAULT_BUTTON_LETTER_SPACING,
  DEFAULT_BUTTON_BORDER,
  SHADOW_PRESETS,
  ShadowPresetKey,
} from "./defaults/button";
import {
  TextareaExpandedModal,
  ExpandButton,
} from "../textarea-expanded-modal";

interface ButtonSectionProps {
  block: ButtonBlock;
}

export const ButtonSection = ({ block }: ButtonSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { register, control, errors, setValue, getValues } = useBlockForm({
    block,
    schema: buttonSchema,
  });

  const handleInsertTag = (
    tag: string,
    fieldName: "text" | "href" = "text",
  ) => {
    const currentVal = getValues(fieldName) || "";
    setValue(fieldName, currentVal + tag);
  };

  const currentShadow = useWatch({ control, name: "shadow" });
  const textValue = useWatch({ control, name: "text" });
  const htmlErrors = useMemo(() => validateHTML(textValue || ""), [textValue]);

  const alignOptions = [
    { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
    { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
    { value: "right", icon: <AlignRight size={16} />, label: "Right" },
  ];

  const widthOptions = [
    { value: "auto", icon: <Minimize2 size={16} />, label: "Auto" },
    { value: "full", icon: <Maximize2 size={16} />, label: "Full Width" },
  ];

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

  const shadowPresetOptions = [
    {
      value: "none",
      icon: <span style={{ fontSize: "12px" }}>None</span>,
      label: "No shadow",
    },
    {
      value: "s",
      icon: <span style={{ fontSize: "12px" }}>S</span>,
      label: "Small",
    },
    {
      value: "m",
      icon: <span style={{ fontSize: "12px" }}>M</span>,
      label: "Medium",
    },
    {
      value: "l",
      icon: <span style={{ fontSize: "12px" }}>L</span>,
      label: "Large",
    },
  ];

  // Helper to determine active shadow preset
  const getActiveShadowPreset = (): string => {
    if (
      !currentShadow ||
      (currentShadow.blur === 0 &&
        currentShadow.x === 0 &&
        currentShadow.y === 0)
    )
      return "none";

    for (const [key, value] of Object.entries(SHADOW_PRESETS)) {
      // Compare only x, y, and blur to keep preset active even if color changes
      if (
        value.blur === currentShadow.blur &&
        value.x === currentShadow.x &&
        value.y === currentShadow.y
      ) {
        return key;
      }
    }
    return "none";
  };

  const handleShadowPresetChange = (preset: string) => {
    const shadowData =
      SHADOW_PRESETS[preset as ShadowPresetKey] || SHADOW_PRESETS.none;
    setValue("shadow", shadowData);
  };

  return (
    <FormSection title="Button Settings">
      <FormField
        label="Button Text"
        error={errors.text?.message as string}
        headerAction={<MergeTagSelector onSelect={handleInsertTag} />}
      >
        <Textarea
          {...register("text")}
          placeholder="Enter button text..."
          minRows={1}
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
        title="Edit Button Text"
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
                defaultValue={DEFAULT_BUTTON_COLOR}
              />
            )}
          />
        </FormField>

        <FormField
          label="Background Color"
          error={errors.backgroundColor?.message as string}
        >
          <Controller
            name="backgroundColor"
            control={control}
            render={({ field }) => (
              <ColorPicker
                value={field.value}
                onChange={field.onChange}
                defaultValue={DEFAULT_BUTTON_BG_COLOR}
              />
            )}
          />
        </FormField>
      </FormGrid>

      <FormGrid cols={2}>
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

        <FormField label="Width">
          <Controller
            name="fullWidth"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value ? "full" : "auto"}
                options={widthOptions}
                onChange={(val) => field.onChange(val === "full")}
              />
            )}
          />
        </FormField>
      </FormGrid>

      <FormGrid cols={2}>
        <FormField
          label="Font Weight"
          error={errors.fontWeight?.message as string}
        >
          <Controller
            name="fontWeight"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? DEFAULT_BUTTON_FONT_WEIGHT}
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

        <FormField label="Text Transform">
          <Controller
            name="textTransform"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value || "none"}
                options={[
                  {
                    value: "none",
                    icon: <span style={{ fontSize: "10px" }}>Aa</span>,
                    label: "Normal",
                  },
                  {
                    value: "uppercase",
                    icon: <span style={{ fontSize: "10px" }}>AA</span>,
                    label: "All Caps",
                  },
                ]}
                onChange={field.onChange}
              />
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
            value={field.value ?? DEFAULT_BUTTON_FONT_SIZE}
            onChange={field.onChange}
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
            max={50}
            value={field.value ?? DEFAULT_BUTTON_BORDER_RADIUS}
            onChange={field.onChange}
          />
        )}
      />

      <FormSection title="Border & Shadow">
        <FormGrid cols={2}>
          <FormField label="Border Style">
            <Controller
              name="border.style"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  value={field.value || DEFAULT_BUTTON_BORDER.style}
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
                  defaultValue={DEFAULT_BUTTON_BORDER.color}
                />
              )}
            />
          </FormField>
        </FormGrid>

        <Controller
          name="border.width"
          control={control}
          render={({ field }) => (
            <Slider
              label="Border Width"
              unit="px"
              min={0}
              max={10}
              value={field.value ?? DEFAULT_BUTTON_BORDER.width}
              onChange={field.onChange}
            />
          )}
        />

        <FormField label="Box Shadow Preset">
          <FormGrid cols={2}>
            <ToggleGroup
              value={getActiveShadowPreset()}
              options={shadowPresetOptions}
              onChange={handleShadowPresetChange}
            />
            <Controller
              name="shadow.color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  defaultValue="#00000033"
                />
              )}
            />
          </FormGrid>
        </FormField>
      </FormSection>

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
            value={field.value ?? DEFAULT_BUTTON_LETTER_SPACING}
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
              value={field.value ?? DEFAULT_BUTTON_PADDING}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>
    </FormSection>
  );
};
