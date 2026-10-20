"use client";

import { createDialogs } from "@senlo/features";
import type {
  Campaign,
  Project,
  EmailTemplate,
  PublicEmailProvider,
} from "@senlo/core";

/** Every dialog the app can open, with the props it takes. */
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
  };
  DELETE_WORKSPACE: {
    project: Project;
  };
  CREATE_TEMPLATE: {
    projectId: number;
  };
  DELETE_TEMPLATE: {
    template: EmailTemplate;
    projectId: number;
  };
  ADD_PROVIDER: Record<string, never>;
  EDIT_PROVIDER: {
    provider: PublicEmailProvider;
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

export type DialogName = keyof DialogPropsMap;

export const { useDialogs, DialogHost } = createDialogs<DialogPropsMap>();
