import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEditorStore } from "../state/editor.store";
import { ContentBlock } from "@senlo/core";

interface UseBlockFormProps<T extends z.ZodTypeAny> {
  block: ContentBlock;
  schema: T;
}

export const useBlockForm = <T extends z.ZodTypeAny>({
  block,
  schema,
}: UseBlockFormProps<T>) => {
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const updateBlockWithoutHistory = useEditorStore((s) => s.updateBlockWithoutHistory);
  
  const {
    register,
    control,
    reset,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<z.infer<T>>({
    resolver: zodResolver(schema as any),
    defaultValues: block.data as any,
    mode: "onChange",
  });

  // Следим за всеми изменениями полей формы
  const formData = useWatch({ control });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Эффект для сброса формы при переключении между блоками
  useEffect(() => {
    isFirstRender.current = true;
    reset(block.data);
  }, [block.id, reset]);

  // Эффект для автоматической синхронизации со стором
  useEffect(() => {
    // Пропускаем первый рендер после reset, чтобы не триггерить сохранение
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // 1. Мгновенное обновление UI (без записи в историю)
    // Сравниваем данные перед обновлением
    const hasChanges = Object.entries(formData).some(([key, value]) => {
      return JSON.stringify(block.data[key as keyof typeof block.data]) !== JSON.stringify(value);
    });

    if (!hasChanges) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      return;
    }

    updateBlockWithoutHistory(block.id, formData);

    // 2. Дебаунс для записи в историю (Undo/Redo)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      updateBlock(block.id, formData);
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [formData, block.id, updateBlock, updateBlockWithoutHistory]);

  return {
    register,
    control,
    errors,
    setValue,
    getValues,
  };
};











