"use client";

import { Controller, useWatch } from "react-hook-form";
import {
  ColorPicker,
  FormField,
  FormGrid,
  FormSection,
  Input,
  PaddingControl,
  Slider,
  ToggleGroup,
} from "@senlo/ui";
import type { ProgressBlock } from "@senlo/core";
import { AlignCenter, AlignLeft, AlignRight, Eye, EyeOff } from "lucide-react";

import { useBlockForm } from "../../../../hooks/use-block-form";
import { progressSchema } from "../../../../schemas/block-schemas";
import { useEditorStore } from "../../../../state/editor.store";
import { ProgressSteps } from "./progress-steps";
import { BoxSection } from "./box-section";
import { ConditionSection } from "./condition-section";
import { fallbacksFor, resolveColor } from "./defaults/common";

interface ProgressSectionProps {
  block: ProgressBlock;
}

const FALLBACKS = fallbacksFor<any>("progress");

const labelOptions = [
  { value: "on", icon: <Eye size={16} />, label: "Show" },
  { value: "off", icon: <EyeOff size={16} />, label: "Hide" },
];

const alignOptions = [
  { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
  { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
  { value: "right", icon: <AlignRight size={16} />, label: "Right" },
];

/** One colour per state, in the order the bar reads: done, now, not yet. */
const STATES = [
  { key: "completed", title: "Completed" },
  { key: "active", title: "Active" },
  { key: "pending", title: "Pending" },
] as const;

export const ProgressSection = ({ block }: ProgressSectionProps) => {
  const { control, errors, setValue } = useBlockForm({
    block,
    schema: progressSchema,
  });

  const globalTextColor = useEditorStore((st) => st.design.settings?.textColor);
  const showLabels = useWatch({ control, name: "showLabels" }) ?? FALLBACKS.showLabels;

  const stepErrors = (errors.steps as any) ?? undefined;
  const stepsMessage =
    (stepErrors?.message as string | undefined) ??
    (stepErrors?.root?.message as string | undefined);

  const labelFallback = (key: (typeof STATES)[number]["key"]) =>
    key === "completed"
      ? resolveColor(undefined, globalTextColor)
      : FALLBACKS[`${key}LabelColor`];

  return (
    <FormSection title="Progress">
      <FormField
        label="Status variable"
        error={errors.statusVariable?.message as string}
        hint="Where the status arrives, such as custom.shipment.status. It is matched against each step's value. A message whose status matches no step does not show this block."
      >
        <Controller
          name="statusVariable"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value ?? ""}
              placeholder="custom.shipment.status"
              className="font-mono text-xs"
            />
          )}
        />
      </FormField>

      <FormField
        label="Steps"
        error={stepsMessage}
        hint="Label is what the recipient reads. Value is the status code your data sends for that step."
      >
        <Controller
          name="steps"
          control={control}
          render={({ field }) => (
            <ProgressSteps
              steps={field.value || []}
              onChange={field.onChange}
              errors={Array.isArray(stepErrors) ? stepErrors : undefined}
            />
          )}
        />
      </FormField>

      <p className="text-xs text-zinc-500">
        A step&rsquo;s state picker only sets how it looks in the canvas, so you
        can see every colour. Messages light the steps from the status in your
        data.
      </p>

      <FormSection title="Bar">
        <FormGrid cols={1}>
          {STATES.map(({ key, title }) => (
            <FormField key={key} label={title}>
              <Controller
                name={`${key}Color`}
                control={control}
                render={({ field }) => (
                  <ColorPicker
                    value={field.value}
                    onChange={field.onChange}
                    defaultValue={FALLBACKS[`${key}Color`]}
                  />
                )}
              />
            </FormField>
          ))}
        </FormGrid>

        <Controller
          name="barHeight"
          control={control}
          render={({ field }) => (
            <Slider
              label="Height"
              unit="px"
              min={1}
              max={24}
              value={field.value ?? FALLBACKS.barHeight}
              onChange={field.onChange}
            />
          )}
        />
        <FormGrid cols={2}>
          <Controller
            name="barRadius"
            control={control}
            render={({ field }) => (
              <Slider
                label="Rounding"
                unit="px"
                min={0}
                max={12}
                value={field.value ?? FALLBACKS.barRadius}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="gap"
            control={control}
            render={({ field }) => (
              <Slider
                label="Gap"
                unit="px"
                min={0}
                max={24}
                value={field.value ?? FALLBACKS.gap}
                onChange={field.onChange}
              />
            )}
          />
        </FormGrid>
      </FormSection>

      <FormSection title="Labels">
        <FormField label="Show labels">
          <Controller
            name="showLabels"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={(field.value ?? FALLBACKS.showLabels) ? "on" : "off"}
                options={labelOptions}
                onChange={(val) => field.onChange(val === "on")}
              />
            )}
          />
        </FormField>

        {showLabels && (
          <>
            <FormGrid cols={1}>
              {STATES.map(({ key, title }) => (
                <FormField key={key} label={title}>
                  <Controller
                    name={`${key}LabelColor`}
                    control={control}
                    render={({ field }) => (
                      <ColorPicker
                        value={field.value}
                        onChange={field.onChange}
                        defaultValue={labelFallback(key)}
                      />
                    )}
                  />
                </FormField>
              ))}
            </FormGrid>

            <FormField label="Alignment">
              <Controller
                name="labelAlign"
                control={control}
                render={({ field }) => (
                  <ToggleGroup
                    value={field.value || FALLBACKS.labelAlign}
                    options={alignOptions}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>

            <FormGrid cols={2}>
              <Controller
                name="fontSize"
                control={control}
                render={({ field }) => (
                  <Slider
                    label="Size"
                    unit="px"
                    min={9}
                    max={24}
                    value={field.value ?? FALLBACKS.fontSize}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="labelSpacing"
                control={control}
                render={({ field }) => (
                  <Slider
                    label="Space above"
                    unit="px"
                    min={0}
                    max={24}
                    value={field.value ?? FALLBACKS.labelSpacing}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormGrid>

            <FormField hint="The bar keeps its steps side by side on a phone and narrows. Set this only if the labels get too tight to read - leave it off and nothing is added to the message.">
              <Controller
                name="mobileFontSize"
                control={control}
                render={({ field }) => (
                  <Slider
                    label="Size on a phone"
                    unit="px"
                    min={0}
                    max={20}
                    value={field.value ?? 0}
                    onChange={(val) => field.onChange(val || undefined)}
                  />
                )}
              />
            </FormField>
          </>
        )}
      </FormSection>

      <FormSection title="Spacing">
        <Controller
          name="padding"
          control={control}
          render={({ field }) => (
            <PaddingControl
              value={field.value ?? FALLBACKS.padding}
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
