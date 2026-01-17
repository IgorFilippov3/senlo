"use client";

import { useGlobalSettingsForm } from "../../../../hooks/use-global-settings-form";
import {
  FormSection,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ColorPicker,
} from "@senlo/ui";
import { Controller } from "react-hook-form";

export const GlobalSection = () => {
  const { register, control, errors } = useGlobalSettingsForm();

  return (
    <FormSection title="Global Settings">
      <FormField
        label="Background Color"
        error={errors.backgroundColor?.message}
      >
        <Controller
          name="backgroundColor"
          control={control}
          render={({ field }) => (
            <ColorPicker value={field.value} onChange={field.onChange} />
          )}
        />
      </FormField>

      <FormField
        label="Content Width (px)"
        error={errors.contentWidth?.message}
      >
        <Input
          type="number"
          {...register("contentWidth", { valueAsNumber: true })}
          placeholder="600"
        />
      </FormField>

      <FormField label="Default Font Family" error={errors.fontFamily?.message}>
        <Controller
          name="fontFamily"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select font..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                <SelectItem value="'Helvetica Neue', Helvetica, sans-serif">
                  Helvetica
                </SelectItem>
                <SelectItem value="'Times New Roman', Times, serif">
                  Times New Roman
                </SelectItem>
                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                <SelectItem value="'Courier New', Courier, monospace">
                  Courier New
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      <FormField label="Default Text Color" error={errors.textColor?.message}>
        <Input {...register("textColor")} placeholder="#111827" />
      </FormField>
    </FormSection>
  );
};
