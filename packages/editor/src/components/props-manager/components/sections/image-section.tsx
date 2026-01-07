"use client";

import { useState, useRef } from "react";
import { useBlockForm } from "../../../../hooks/use-block-form";
import { imageSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  Input,
  FormGrid,
  ToggleGroup,
  Slider,
  PaddingControl,
  ColorPicker,
  Button,
} from "@senlo/ui";
import { ImageBlock } from "@senlo/core";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Minimize2,
  Square,
  Minus,
  MoreHorizontal,
  Upload,
  Loader2,
} from "lucide-react";
import { Controller } from "react-hook-form";
import {
  DEFAULT_IMAGE_ALIGN,
  DEFAULT_IMAGE_BORDER_RADIUS,
  DEFAULT_IMAGE_PADDING,
  DEFAULT_IMAGE_BORDER,
} from "./defaults/image";
import { DEFAULT_PADDING } from "./defaults/common";

interface ImageSectionProps {
  block: ImageBlock;
}

export const ImageSection = ({ block }: ImageSectionProps) => {
  const { register, control, errors, setValue } = useBlockForm({
    block,
    schema: imageSchema,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      setValue("src", data.url as any, { shouldValidate: true, shouldDirty: true });
    } catch (error) {
      console.error("Upload failed", error);
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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

  return (
    <FormSection title="Image Settings">
      <FormField label="Image URL" error={errors.src?.message as string}>
        <div className="flex gap-2">
          <Input
            {...register("src")}
            placeholder="https://example.com/image.jpg"
            className="flex-1"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Upload image"
          >
            {isUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleUpload}
          />
        </div>
      </FormField>

      <FormField label="Link URL" error={errors.href?.message as string}>
        <Input {...register("href")} placeholder="https://example.com" />
      </FormField>

      <FormField label="Alt Text" error={errors.alt?.message as string}>
        <Input {...register("alt")} placeholder="Describe the image" />
      </FormField>

      <FormGrid cols={2}>
        <FormField label="Alignment">
          <Controller
            name="align"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value || DEFAULT_IMAGE_ALIGN}
                options={alignOptions}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <FormField label="Width Mode">
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

      <Controller
        name="width"
        control={control}
        render={({ field }) => (
          <Slider
            label="Image Width"
            unit="px"
            min={20}
            max={600}
            value={field.value ?? 300}
            onChange={field.onChange}
            disabled={!!control._formValues.fullWidth}
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
            max={100}
            value={field.value ?? DEFAULT_IMAGE_BORDER_RADIUS}
            onChange={field.onChange}
          />
        )}
      />

      <FormSection title="Border">
        <FormGrid cols={2}>
          <FormField label="Style">
            <Controller
              name="border.style"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  value={field.value || DEFAULT_IMAGE_BORDER.style}
                  options={borderStyleOptions}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Color">
            <Controller
              name="border.color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  defaultValue={DEFAULT_IMAGE_BORDER.color}
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
              max={20}
              value={field.value ?? DEFAULT_IMAGE_BORDER.width}
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
              value={field.value ?? DEFAULT_IMAGE_PADDING}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>
    </FormSection>
  );
};
