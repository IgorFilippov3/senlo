import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEditorStore } from "../state/editor.store";
import { globalSettingsSchema } from "../schemas/block-schemas";

export const useGlobalSettingsForm = () => {
  const settings = useEditorStore((s) => s.design.settings);
  const updateGlobalSettings = useEditorStore((s) => s.updateGlobalSettings);
  const updateGlobalSettingsWithoutHistory = useEditorStore((s) => s.updateGlobalSettingsWithoutHistory);
  
  const {
    register,
    control,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof globalSettingsSchema>>({
    resolver: zodResolver(globalSettingsSchema as any),
    defaultValues: settings as any,
    mode: "onChange",
  });

  const formData = useWatch({ control });
  const formDataRef = useRef(formData);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Keep ref in sync
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Reset form when settings change externally (e.g. undo/redo)
  useEffect(() => {
    // Only reset if settings from store are actually different from current form state
    const hasExternalChanges = Object.entries(settings || {}).some(([key, value]) => {
      return JSON.stringify(formDataRef.current?.[key as keyof typeof formDataRef.current]) !== JSON.stringify(value);
    });

    if (hasExternalChanges) {
      isFirstRender.current = true;
      reset(settings);
    }
  }, [settings, reset]);

  // Handle auto-save to store
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Check if there are actual changes compared to current store settings
    const hasChanges = Object.entries(formData || {}).some(([key, value]) => {
      return JSON.stringify(settings?.[key as keyof typeof settings]) !== JSON.stringify(value);
    });

    if (!hasChanges) return;

    // 1. Update UI immediately
    updateGlobalSettingsWithoutHistory(formData);

    // 2. Debounce history update
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      updateGlobalSettings(formData);
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [formData, updateGlobalSettings, updateGlobalSettingsWithoutHistory]);

  return {
    register,
    control,
    errors,
  };
};











