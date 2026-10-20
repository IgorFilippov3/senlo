"use client";

import { lazy } from "react";
import type { DialogComponents } from "@senlo/features";
import { DialogHost, type DialogPropsMap } from "./store";

const EditTriggerConfigDialog = lazy(
  () => import("../../components/triggers/edit-trigger-dialog"),
);
const DeleteTriggerDialog = lazy(
  () => import("../../components/triggers/delete-trigger-dialog"),
);
const CreateWorkspaceDialog = lazy(
  () => import("../../components/workspaces/create-workspace-dialog"),
);
const DeleteWorkspaceDialog = lazy(
  () => import("../../components/workspaces/delete-workspace-dialog"),
);
const CreateTemplateDialog = lazy(
  () => import("../../components/templates/create-template-dialog"),
);
const DeleteTemplateDialog = lazy(
  () => import("../../components/templates/delete-template-dialog"),
);
const EmailProviderDialog = lazy(
  () => import("../../components/providers/email-provider-dialog"),
);
const DeleteProviderDialog = lazy(() =>
  import("../../components/providers/delete-provider-dialogs").then((m) => ({
    default: m.DeleteEmailProviderDialog,
  })),
);
const AddAiProviderDialog = lazy(
  () => import("../../components/providers/ai-provider-dialog"),
);
const DeleteAiProviderDialog = lazy(() =>
  import("../../components/providers/delete-provider-dialogs").then((m) => ({
    default: m.DeleteAiProviderDialog,
  })),
);

const dialogComponents: DialogComponents<DialogPropsMap> = {
  EDIT_TRIGGER_CONFIG: EditTriggerConfigDialog,
  DELETE_TRIGGER: DeleteTriggerDialog,
  CREATE_WORKSPACE: CreateWorkspaceDialog,
  DELETE_WORKSPACE: DeleteWorkspaceDialog,
  CREATE_TEMPLATE: CreateTemplateDialog,
  DELETE_TEMPLATE: DeleteTemplateDialog,
  ADD_PROVIDER: EmailProviderDialog,
  EDIT_PROVIDER: EmailProviderDialog,
  DELETE_PROVIDER: DeleteProviderDialog,
  ADD_AI_PROVIDER: AddAiProviderDialog,
  DELETE_AI_PROVIDER: DeleteAiProviderDialog,
};

export function DialogProvider() {
  return <DialogHost components={dialogComponents} />;
}
