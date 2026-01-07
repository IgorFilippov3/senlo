import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEditorStore } from "../state/editor.store";
import { RowBlock, rowBlockSchema } from "@senlo/core";

// We only want to edit the settings of the row
const rowSettingsSchema = rowBlockSchema.shape.settings;
type RowSettings = z.infer<typeof rowSettingsSchema>;

interface UseRowFormProps {
  row: RowBlock;
}

export const useRowForm = ({ row }: UseRowFormProps) => {
  const updateRow = useEditorStore((s) => s.updateRow);
  const updateRowWithoutHistory = useEditorStore((s) => s.updateRowWithoutHistory);
  
  const {
    register,
    control,
    reset,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<RowSettings>({
    resolver: zodResolver(rowSettingsSchema as any),
    defaultValues: row.settings,
    mode: "onChange",
  });

  const formData = useWatch({ control });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    isFirstRender.current = true;
    reset(row.settings);
  }, [row.id, reset, row.settings]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const hasChanges = Object.entries(formData).some(([key, value]) => {
      return JSON.stringify(row.settings[key as keyof typeof row.settings]) !== JSON.stringify(value);
    });

    if (!hasChanges) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      return;
    }

    updateRowWithoutHistory(row.id, formData as RowSettings);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      updateRow(row.id, formData as RowSettings);
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [formData, row.id, updateRow, updateRowWithoutHistory]);

  return {
    register,
    control,
    errors,
    setValue,
    getValues,
  };
};





