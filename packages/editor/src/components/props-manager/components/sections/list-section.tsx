import React, { memo } from "react";
import { useBlockForm } from "../../../../hooks/use-block-form";
import { listSchema } from "../../../../schemas/block-schemas";
import {
  FormSection,
  FormField,
  Input,
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
  Button,
} from "@senlo/ui";
import { ListBlock } from "@senlo/core";
import { AlignLeft, AlignCenter, AlignRight, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";
import { DEFAULT_PADDING, DEFAULT_COLOR } from "./defaults/common";
import {
  DEFAULT_LIST_FONT_SIZE,
  DEFAULT_LIST_LINE_HEIGHT,
  DEFAULT_LIST_FONT_WEIGHT,
  DEFAULT_LIST_TYPE,
} from "./defaults/list";
import {
  TextareaExpandedModal,
  ExpandButton,
} from "../textarea-expanded-modal";
import { useState } from "react";

interface ListSectionProps {
  block: ListBlock;
}

export const ListSection = memo(({ block }: ListSectionProps) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const { register, control, errors, setValue, getValues } = useBlockForm({
    block,
    schema: listSchema,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items" as never,
  });

  const alignOptions = [
    { value: "left", icon: <AlignLeft size={16} />, label: "Left" },
    { value: "center", icon: <AlignCenter size={16} />, label: "Center" },
    { value: "right", icon: <AlignRight size={16} />, label: "Right" },
  ];

  const listTypeOptions = [
    { value: "unordered", label: "Bullets", icon: null },
    { value: "ordered", label: "Numbered", icon: null },
  ];

  return (
    <FormSection title="List Settings">
      <FormField label="List Type">
        <Controller
          name="listType"
          control={control}
          render={({ field }) => (
            <ToggleGroup
              value={field.value ?? DEFAULT_LIST_TYPE}
              options={listTypeOptions}
              onChange={field.onChange}
            />
          )}
        />
      </FormField>

      <FormSection title="Items">
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="space-y-1">
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <Input
                    {...register(`items.${index}` as never)}
                    placeholder={`Item ${index + 1}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                >
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
              <ExpandButton onClick={() => setExpandedIndex(index)} />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => append("")}
          >
            <Plus size={14} /> Add Item
          </Button>
        </div>
      </FormSection>

      <TextareaExpandedModal
        isOpen={expandedIndex !== null}
        onClose={() => setExpandedIndex(null)}
        value={
          expandedIndex !== null
            ? getValues(`items.${expandedIndex}` as any)
            : ""
        }
        onChange={(val) =>
          expandedIndex !== null &&
          setValue(`items.${expandedIndex}` as any, val)
        }
        onInsertTag={(tag) =>
          expandedIndex !== null &&
          setValue(
            `items.${expandedIndex}` as any,
            getValues(`items.${expandedIndex}` as any) + tag,
          )
        }
        title={`Edit List Item ${expandedIndex !== null ? expandedIndex + 1 : ""}`}
      />

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

      <FormField
        label="Font Weight"
        error={errors.fontWeight?.message as string}
      >
        <Controller
          name="fontWeight"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? DEFAULT_LIST_FONT_WEIGHT}
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

      <Controller
        name="fontSize"
        control={control}
        render={({ field }) => (
          <Slider
            label="Font Size"
            unit="px"
            min={12}
            max={72}
            value={field.value ?? DEFAULT_LIST_FONT_SIZE}
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
            value={field.value ?? DEFAULT_LIST_LINE_HEIGHT}
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
});
