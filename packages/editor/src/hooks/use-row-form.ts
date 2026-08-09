import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEditorStore } from "../state/editor.store";
import { RowBlock, rowBlockSchema } from "@senlo/core";

const rowSettingsSchema = rowBlockSchema.shape.settings;
type RowSettings = z.infer<typeof rowSettingsSchema>;

interface UseRowFormProps {
  row: RowBlock;
}

export const useRowForm = ({ row }: UseRowFormProps) => {
  const updateRow = useEditorStore((s) => s.updateRow);
  const updateRowWithoutHistory = useEditorStore(
    (s) => s.updateRowWithoutHistory,
  );

  const {
    register,
    control,
    reset,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<
    RowSettings & {
      condition?: RowBlock["condition"];
      loop?: RowBlock["loop"];
    }
  >({
    resolver: zodResolver(
      z.object({
        ...(rowSettingsSchema as any)._def.innerType.unwrap().shape,
        condition: rowBlockSchema.shape.condition,
        loop: rowBlockSchema.shape.loop,
      }) as any,
    ),
    defaultValues: {
      ...row.settings,
      condition: row.condition,
      loop: row.loop,
    } as any,
    mode: "onChange",
  });

  const formData = useWatch({ control });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    isFirstRender.current = true;
    reset({
      ...row.settings,
      condition: row.condition,
      loop: row.loop,
    } as any);
  }, [row.id, reset, row.settings, row.condition, row.loop]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const { condition, loop, ...settings } = formData as any;

    updateRowWithoutHistory(row.id, settings, condition, loop);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      updateRow(row.id, settings, condition, loop);
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
