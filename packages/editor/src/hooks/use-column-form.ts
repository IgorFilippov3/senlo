import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  columnSettingsSchema,
  type ColumnId,
  type ColumnSettings,
  type RowId,
} from "@senlo/core";
import { useEditorStore } from "../state/editor.store";

interface UseColumnFormProps {
  rowId: RowId;
  columnId: ColumnId;
  settings?: ColumnSettings;
}

/**
 * The column's card as a form. Same shape as `useRowForm`: every change lands
 * in the document at once, and a debounced call records it once typing stops.
 */
export const useColumnForm = ({ rowId, columnId, settings }: UseColumnFormProps) => {
  const updateColumn = useEditorStore((s) => s.updateColumn);
  const updateColumnWithoutHistory = useEditorStore(
    (s) => s.updateColumnWithoutHistory,
  );

  const {
    control,
    reset,
    formState: { errors },
  } = useForm<ColumnSettings>({
    resolver: zodResolver(columnSettingsSchema as any),
    defaultValues: (settings ?? {}) as any,
    mode: "onChange",
  });

  const formData = useWatch({ control });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Another column selected: the form starts over from that column's values
  // rather than carrying the previous one's into it.
  useEffect(() => {
    isFirstRender.current = true;
    reset((settings ?? {}) as any);
  }, [columnId, reset]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const next = formData as ColumnSettings;

    updateColumnWithoutHistory(rowId, columnId, next);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      updateColumn(rowId, columnId, next);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [formData, rowId, columnId, updateColumn, updateColumnWithoutHistory]);

  return { control, errors };
};
