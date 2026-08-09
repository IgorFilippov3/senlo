"use client";

import { useState } from "react";
import { useRowForm } from "../../../../hooks/use-row-form";
import {
  FormSection,
  FormField,
  FormGrid,
  ToggleGroup,
  ColorPicker,
  PaddingControl,
  Slider,
  Button,
} from "@senlo/ui";
import {
  AlignLeft,
  AlignCenter,
  Maximize2,
  Minimize2,
  Link,
  Link2Off,
} from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { RowBlock } from "@senlo/core";
import { ConditionSection } from "./condition-section";
import { LoopSection } from "./loop-section";

interface RowSectionProps {
  row: RowBlock;
}

export const RowSection = ({ row }: RowSectionProps) => {
  const { control, errors, setValue, getValues } = useRowForm({ row });

  // Инициализируем состояние линковки на основе текущих значений
  const [isLinked, setIsLinked] = useState(() => {
    const radius = row.settings.borderRadius;
    if (!radius) return true;
    return radius.top === radius.bottom;
  });

  const alignOptions = [
    { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
    { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
  ];

  const widthOptions = [
    { value: "auto", icon: <Minimize2 size={16} />, label: "Content Width" },
    { value: "full", icon: <Maximize2 size={16} />, label: "Full Width" },
  ];

  const handleRadiusChange = (val: number, type: "top" | "bottom" | "all") => {
    if (type === "all") {
      setValue("borderRadius", { top: val, bottom: val });
    } else if (type === "top") {
      const currentBottom = getValues("borderRadius.bottom") || 0;
      setValue("borderRadius.top", val);
      if (isLinked) setValue("borderRadius.bottom", val);
    } else {
      const currentTop = getValues("borderRadius.top") || 0;
      setValue("borderRadius.bottom", val);
      if (isLinked) setValue("borderRadius.top", val);
    }
  };

  const borderRadius = useWatch({ control, name: "borderRadius" }) || {
    top: 0,
    bottom: 0,
  };

  return (
    <FormSection title="Row Settings">
      <FormField
        label="Background Color"
        error={errors.backgroundColor?.message}
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
        <FormField label="Alignment">
          <Controller
            name="align"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value || "center"}
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

      <FormSection
        title="Corner Radius"
        headerAction={
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 w-7 p-0 flex items-center justify-center rounded transition-all ${
              isLinked
                ? "bg-zinc-100 text-blue-600 border border-zinc-200"
                : "bg-transparent text-zinc-500 hover:bg-zinc-100"
            }`}
            onClick={() => setIsLinked(!isLinked)}
            title={isLinked ? "Unlink corners" : "Link corners"}
          >
            {isLinked ? <Link size={14} /> : <Link2Off size={14} />}
          </Button>
        }
      >
        {isLinked ? (
          <Slider
            label="All Corners"
            unit="px"
            min={0}
            max={100}
            value={borderRadius.top ?? 0}
            onChange={(val) => handleRadiusChange(val, "all")}
          />
        ) : (
          <div className="space-y-4">
            <Slider
              label="Top Corners"
              unit="px"
              min={0}
              max={100}
              value={borderRadius.top ?? 0}
              onChange={(val) => handleRadiusChange(val, "top")}
            />
            <Slider
              label="Bottom Corners"
              unit="px"
              min={0}
              max={100}
              value={borderRadius.bottom ?? 0}
              onChange={(val) => handleRadiusChange(val, "bottom")}
            />
          </div>
        )}
      </FormSection>

      <FormSection title="Spacing">
        <Controller
          name="padding"
          control={control}
          render={({ field }) => (
            <PaddingControl
              value={field.value || { top: 0, right: 0, bottom: 0, left: 0 }}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <ConditionSection control={control} setValue={setValue} />
      <LoopSection control={control} setValue={setValue} />
    </FormSection>
  );
};
