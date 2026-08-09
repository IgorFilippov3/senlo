"use client";

import React from "react";
import { FormSection, FormField, Input, Button } from "@senlo/ui";
import { Controller, useWatch } from "react-hook-form";
import { Trash2, Plus, Repeat } from "lucide-react";

interface LoopSectionProps {
  control: any;
  setValue: any;
}

export const LoopSection = ({ control, setValue }: LoopSectionProps) => {
  const loop = useWatch({ control, name: "loop" });

  const handleAddLoop = () => {
    setValue("loop", {
      variable: "",
      alias: "item",
    });
  };

  const handleRemoveLoop = () => {
    setValue("loop", undefined);
  };

  if (!loop) {
    return (
      <FormSection title="Loop Settings">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleAddLoop}
        >
          <Plus size={16} className="mr-2" />
          Add Loop (for each)
        </Button>
      </FormSection>
    );
  }

  return (
    <FormSection
      title="Loop Settings"
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemoveLoop}
          className="h-10 w-10 p-0 text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={24} />
        </Button>
      }
    >
      <FormField label="Items Path (Variable)">
        <Controller
          name="loop.variable"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="e.g. items or order.products" />
          )}
        />
      </FormField>

      <FormField label="Item Alias">
        <Controller
          name="loop.alias"
          control={control}
          render={({ field }) => <Input {...field} placeholder="e.g. item" />}
        />
      </FormField>

      <div className="mt-2 text-xs text-zinc-500 flex items-start gap-2 bg-zinc-50 p-2 rounded">
        <Repeat size={14} className="mt-0.5 shrink-0" />
        <p>
          This row will repeat for each item in{" "}
          <strong>{loop.variable || "..."}</strong>. Use{" "}
          <strong>
            {"{{"}
            {loop.alias || "item"}.property{"}}"}
          </strong>{" "}
          to access item data.
        </p>
      </div>
    </FormSection>
  );
};
