"use client";

import React, { lazy, Suspense } from "react";
import { useDialogStore, DialogType, DialogPropsMap } from "./store";

type DialogComponentProps<T extends DialogType> = DialogPropsMap[T] & {
  isOpen: boolean;
  onClose: () => void;
};

const EditTriggerConfigDialog = lazy(
  () => import("../../components/triggers/edit-trigger-dialog"),
);
const DeleteTriggerDialog = lazy(
  () => import("../../components/triggers/delete-trigger-dialog"),
);
const CreateWorkspaceDialog = lazy(
  () => import("../../components/workspaces/create-workspace-dialog"),
);
const EditWorkspaceDialog = lazy(
  () => import("../../components/workspaces/edit-workspace-dialog"),
);
const DeleteWorkspaceDialog = lazy(
  () => import("../../components/workspaces/delete-workspace-dialog"),
);
const CreateTemplateDialog = lazy(
  () =>
    import("../../app/(app)/workspace/[id]/templates/create-template-dialog"),
);
const DeleteTemplateDialog = lazy(
  () =>
    import("../../app/(app)/workspace/[id]/templates/delete-template-dialog"),
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

const dialogComponents: {
  [K in DialogType]: React.ComponentType<DialogComponentProps<K>>;
} = {
  EDIT_TRIGGER_CONFIG: EditTriggerConfigDialog,
  DELETE_TRIGGER: DeleteTriggerDialog,
  CREATE_WORKSPACE: CreateWorkspaceDialog,
  EDIT_WORKSPACE: EditWorkspaceDialog,
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
  const { type, props, isOpen, close } = useDialogStore();

  if (!isOpen || !type || !props) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = dialogComponents[type as DialogType] as any;

  return (
    <Suspense fallback={null}>
      <Component {...props} isOpen={isOpen} onClose={close} />
    </Suspense>
  );
}
