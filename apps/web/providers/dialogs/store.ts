import { create } from "zustand";
import {
  Campaign,
  Project,
  EmailTemplate,
  EmailProvider,
  AiProvider,
} from "@senlo/core";

export type DialogType =
  | "EDIT_TRIGGER_CONFIG"
  | "DELETE_TRIGGER"
  | "CREATE_WORKSPACE"
  | "EDIT_WORKSPACE"
  | "DELETE_WORKSPACE"
  | "CREATE_TEMPLATE"
  | "DELETE_TEMPLATE"
  | "ADD_PROVIDER"
  | "EDIT_PROVIDER"
  | "DELETE_PROVIDER"
  | "ADD_AI_PROVIDER"
  | "DELETE_AI_PROVIDER";

export interface DialogPropsMap {
  EDIT_TRIGGER_CONFIG: {
    campaign: Campaign;
    project: Project;
    template: EmailTemplate;
  };
  DELETE_TRIGGER: {
    campaign: Campaign;
  };
  CREATE_WORKSPACE: Record<string, never>;
  EDIT_WORKSPACE: {
    project: Project;
    providers: EmailProvider[];
    aiProviders: AiProvider[];
  };
  DELETE_WORKSPACE: {
    project: Project;
  };
  CREATE_TEMPLATE: {
    projectId: string;
  };
  DELETE_TEMPLATE: {
    template: EmailTemplate;
    projectId: number;
  };
  ADD_PROVIDER: Record<string, never>;
  EDIT_PROVIDER: {
    provider: EmailProvider;
  };
  DELETE_PROVIDER: {
    providerId: number;
    name: string;
  };
  ADD_AI_PROVIDER: Record<string, never>;
  DELETE_AI_PROVIDER: {
    providerId: number;
    name: string;
  };
}

interface DialogState<T extends DialogType = DialogType> {
  type: T | null;
  props: DialogPropsMap[T] | null;
  isOpen: boolean;
  open: <K extends DialogType>(type: K, props: DialogPropsMap[K]) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  type: null,
  props: null,
  isOpen: false,
  open: <K extends DialogType>(type: K, props: DialogPropsMap[K]): void =>
    set({
      type: type as DialogType,
      props: props as DialogPropsMap[DialogType],
      isOpen: true,
    }),
  close: (): void => set({ isOpen: false, type: null, props: null }),
}));
