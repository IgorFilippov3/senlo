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
  Square,
  StretchHorizontal,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  MoveDownRight,
} from "lucide-react";
import { Controller, useWatch } from "react-hook-form";
import { RowBlock } from "@senlo/core";
import { useEditorStore } from "../../../../state/editor.store";
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
    { value: "custom", icon: <Maximize2 size={16} />, label: "Custom" },
  ];

  const bandOptions = [
    { value: "contained", icon: <Square size={16} />, label: "Contained" },
    {
      value: "band",
      icon: <StretchHorizontal size={16} />,
      label: "Full-width",
    },
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

  // The document's width is the row's default and its ceiling, exactly as the
  // renderer treats it, so the slider cannot offer a width the message would
  // then clamp away.
  const contentWidth =
    useEditorStore((s) => s.design.settings?.contentWidth) || 600;
  const width = useWatch({ control, name: "width" });
  const MIN_WIDTH = 200;

  const backgroundColor = useWatch({ control, name: "backgroundColor" });
  const gradient = useWatch({ control, name: "backgroundGradient" });

  const fillOptions = [
    { value: "solid", icon: <Square size={16} />, label: "Solid" },
    { value: "gradient", icon: <MoveDownRight size={16} />, label: "Gradient" },
  ];

  // CSS degrees. Four directions rather than a free 0-360 slider: these are the
  // ones authors ask for, and the middle values of such a slider are ones
  // nobody can picture before dragging to them.
  const directionOptions = [
    { value: "180", icon: <ArrowDown size={16} />, label: "Down" },
    { value: "0", icon: <ArrowUp size={16} />, label: "Up" },
    { value: "90", icon: <ArrowRight size={16} />, label: "Right" },
    { value: "135", icon: <MoveDownRight size={16} />, label: "Diagonal" },
  ];

  /**
   * Turning the gradient on seeds it from the colour the row already has, so
   * the first thing the author sees is their own row rather than someone
   * else's palette - and writes the first stop back into `backgroundColor` if
   * the row had none, because that colour is what two recipients in five will
   * actually see.
   */
  const handleFillChange = (value: string) => {
    if (value === "solid") {
      setValue("backgroundGradient", undefined, { shouldDirty: true });
      return;
    }

    const base =
      backgroundColor && backgroundColor !== "transparent"
        ? backgroundColor
        : "#eef0fb";

    setValue(
      "backgroundGradient",
      { from: base, to: base, angle: 180 },
      { shouldDirty: true },
    );

    if (!backgroundColor || backgroundColor === "transparent") {
      setValue("backgroundColor", base, { shouldDirty: true });
    }
  };

  return (
    <FormSection title="Row Settings">
      <FormField
        label="Background Color"
        error={errors.backgroundColor?.message}
        hint={
          gradient
            ? "The colour on its own is what Outlook on Windows, Yahoo and AOL show - they do not render gradients. Pick one the design survives."
            : undefined
        }
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

      <FormField label="Fill">
        <ToggleGroup
          value={gradient ? "gradient" : "solid"}
          options={fillOptions}
          onChange={handleFillChange}
        />
      </FormField>

      {gradient && (
        <FormSection title="Gradient">
          <FormGrid cols={2}>
            <FormField
              label="From"
              error={errors.backgroundGradient?.from?.message}
            >
              <Controller
                name="backgroundGradient.from"
                control={control}
                render={({ field }) => (
                  <ColorPicker
                    value={field.value}
                    onChange={field.onChange}
                    defaultValue="#eef0fb"
                  />
                )}
              />
            </FormField>
            <FormField
              label="To"
              error={errors.backgroundGradient?.to?.message}
            >
              <Controller
                name="backgroundGradient.to"
                control={control}
                render={({ field }) => (
                  <ColorPicker
                    value={field.value}
                    onChange={field.onChange}
                    defaultValue="#eef0fb"
                  />
                )}
              />
            </FormField>
          </FormGrid>

          <FormField label="Direction">
            <Controller
              name="backgroundGradient.angle"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  value={String(field.value ?? 180)}
                  options={directionOptions}
                  onChange={(val) => field.onChange(Number(val))}
                />
              )}
            />
          </FormField>
        </FormSection>
      )}

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
            name="width"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value ? "custom" : "auto"}
                options={widthOptions}
                onChange={(val) =>
                  // Unset means "whatever the template is", which is what every
                  // row was before this field existed - not a number that has
                  // to be kept in step with the template's own width.
                  field.onChange(val === "custom" ? contentWidth : undefined)
                }
              />
            )}
          />
        </FormField>
      </FormGrid>

      {width !== undefined && (
        <Controller
          name="width"
          control={control}
          render={({ field }) => (
            <Slider
              label="Row Width"
              unit="px"
              min={MIN_WIDTH}
              max={contentWidth}
              value={Math.min(field.value ?? contentWidth, contentWidth)}
              onChange={field.onChange}
            />
          )}
        />
      )}

      <FormField
        label="Background"
        hint="A full-width background runs the row's colour across the whole message while its content stays at the width above - the band behind a header or a footer."
      >
        <Controller
          name="fullWidth"
          control={control}
          render={({ field }) => (
            <ToggleGroup
              value={field.value ? "band" : "contained"}
              options={bandOptions}
              onChange={(val) => field.onChange(val === "band")}
            />
          )}
        />
      </FormField>

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

        <FormField hint="The gap around the row, outside its background - the space that separates it from the rows above and below. Adjacent gaps add up: 16 below this row and 16 above the next one make 32.">
          <Controller
            name="margin"
            control={control}
            render={({ field }) => (
              <PaddingControl
                title="Outer spacing"
                value={field.value || { top: 0, right: 0, bottom: 0, left: 0 }}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </FormSection>

      <ConditionSection control={control} setValue={setValue} />
      <LoopSection control={control} setValue={setValue} />
    </FormSection>
  );
};
