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
import type { TableBlock } from "@senlo/core";
import {
  Database,
  Eye,
  EyeOff,
  Minus,
  MoreHorizontal,
  PencilLine,
  Square,
} from "lucide-react";

import { useBlockForm } from "../../../../hooks/use-block-form";
import { tableSchema } from "../../../../schemas/block-schemas";
import { TableColumns } from "./table-columns";
import { TableRows } from "./table-rows";
import { BoxSection } from "./box-section";
import { ConditionSection } from "./condition-section";
import { fallbacksFor } from "./defaults/common";

interface TableSectionProps {
  block: TableBlock;
}

const FALLBACKS = fallbacksFor<any>("table");

const ruleStyleOptions = [
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

const headerOptions = [
  { value: "on", icon: <Eye size={16} />, label: "Show" },
  { value: "off", icon: <EyeOff size={16} />, label: "Hide" },
];

const sourceOptions = [
  { value: "typed", icon: <PencilLine size={16} />, label: "Typed here" },
  { value: "data", icon: <Database size={16} />, label: "From data" },
];

export const TableSection = ({ block }: TableSectionProps) => {
  const { control, errors, setValue } = useBlockForm({
    block,
    schema: tableSchema,
  });

  const columns = useWatch({ control, name: "columns" }) || [];
  const source = useWatch({ control, name: "source" });
  const rows = useWatch({ control, name: "rows" }) || [];
  const showHeader = useWatch({ control, name: "showHeader" }) ?? true;

  const fromData = Boolean(source);

  /**
   * Switching the source keeps whichever side the author was not using, so
   * flipping to look at the other mode and back does not throw their work away.
   */
  const handleSourceChange = (value: string) => {
    if (value === "data") {
      setValue("source", "items", { shouldDirty: true });
      return;
    }

    setValue("source", undefined, { shouldDirty: true });
    if (!rows.length) {
      setValue("rows", [columns.map(() => "")], { shouldDirty: true });
    }
  };

  return (
    <FormSection title="Table">
      <FormField
        label="Columns"
        hint="Colour and weight set here apply to a column's body cells. The header is styled as a band, below."
      >
        <Controller
          name="columns"
          control={control}
          render={({ field }) => (
            <TableColumns
              columns={field.value || []}
              showKeys={fromData}
              onChange={field.onChange}
            />
          )}
        />
      </FormField>

      <FormField label="Rows">
        <ToggleGroup
          value={fromData ? "data" : "typed"}
          options={sourceOptions}
          onChange={handleSourceChange}
        />
      </FormField>

      {fromData ? (
        <FormField
          label="Items Path"
          error={errors.source?.message as string}
          hint="The array these rows come from, such as items or custom.items. Each column shows its own field of each item."
        >
          <Controller
            name="source"
            control={control}
            render={({ field }) => (
              <Input {...field} value={field.value ?? ""} placeholder="items" />
            )}
          />
        </FormField>
      ) : (
        <Controller
          name="rows"
          control={control}
          render={({ field }) => (
            <TableRows
              columns={columns}
              rows={field.value || []}
              onChange={field.onChange}
            />
          )}
        />
      )}

      <FormSection title="Header">
        <FormField label="Show header">
          <Controller
            name="showHeader"
            control={control}
            render={({ field }) => (
              <ToggleGroup
                value={field.value ?? true ? "on" : "off"}
                options={headerOptions}
                onChange={(val) => field.onChange(val === "on")}
              />
            )}
          />
        </FormField>

        {showHeader && (
          <>
            <FormGrid cols={2}>
              <FormField label="Background">
                <Controller
                  name="headerBackgroundColor"
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
              <FormField label="Text Color">
                <Controller
                  name="headerStyle.color"
                  control={control}
                  render={({ field }) => (
                    <ColorPicker
                      value={field.value}
                      onChange={field.onChange}
                      defaultValue="#111827"
                    />
                  )}
                />
              </FormField>
            </FormGrid>

            <Controller
              name="headerStyle.fontSize"
              control={control}
              render={({ field }) => (
                <Slider
                  label="Header Size"
                  unit="px"
                  min={9}
                  max={28}
                  value={field.value ?? FALLBACKS.headerStyle.fontSize}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        )}
      </FormSection>

      <FormSection title="Rules">
        <FormGrid cols={2}>
          <FormField label="Style">
            <Controller
              name="rowDivider.style"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  value={field.value || "solid"}
                  options={ruleStyleOptions}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          <FormField label="Color">
            <Controller
              name="rowDivider.color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  defaultValue={FALLBACKS.rowDivider.color}
                />
              )}
            />
          </FormField>
        </FormGrid>

        <FormGrid cols={2}>
          <Controller
            name="headerDivider.width"
            control={control}
            render={({ field }) => (
              <Slider
                label="Under header"
                unit="px"
                min={0}
                max={8}
                value={field.value ?? FALLBACKS.headerDivider.width}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="rowDivider.width"
            control={control}
            render={({ field }) => (
              <Slider
                label="Between rows"
                unit="px"
                min={0}
                max={8}
                value={field.value ?? FALLBACKS.rowDivider.width}
                onChange={field.onChange}
              />
            )}
          />
        </FormGrid>
      </FormSection>

      <FormSection title="Text">
        <FormGrid cols={2}>
          <FormField
            label="Color"
            hint="Default for every column. A column can set its own."
          >
            <Controller
              name="textStyle.color"
              control={control}
              render={({ field }) => (
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  defaultValue="#111827"
                />
              )}
            />
          </FormField>
          <Controller
            name="textStyle.fontSize"
            control={control}
            render={({ field }) => (
              <Slider
                label="Size"
                unit="px"
                min={9}
                max={28}
                value={field.value ?? FALLBACKS.textStyle.fontSize}
                onChange={field.onChange}
              />
            )}
          />
        </FormGrid>

        <FormField hint="The table keeps its columns on a phone and narrows. Set this only if the columns get too tight to read - leave it off and nothing is added to the message.">
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
      </FormSection>

      <FormSection title="Spacing">
        <Controller
          name="cellPadding"
          control={control}
          render={({ field }) => (
            <PaddingControl
              title="Cell padding"
              value={field.value ?? FALLBACKS.cellPadding}
              onChange={field.onChange}
            />
          )}
        />
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
