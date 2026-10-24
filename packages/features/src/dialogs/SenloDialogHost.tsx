// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { lazy } from "react";
import type { DialogComponents } from "../shared/dialogs";
import { SenloDialogStore, type SenloDialogProps } from "./registry";

const EmailProviderFormDialog = lazy(() => import("./EmailProviderFormDialog"));
const deleteProviderDialogs = () => import("./DeleteProviderConfirmDialogs");

const components: DialogComponents<SenloDialogProps> = {
  EDIT_TRIGGER_CONFIG: lazy(() => import("./EditTriggerConfigDialog")),
  DELETE_TRIGGER: lazy(() => import("./DeleteTriggerConfirmDialog")),
  CREATE_WORKSPACE: lazy(() => import("./CreateWorkspaceFormDialog")),
  DELETE_WORKSPACE: lazy(() => import("./DeleteWorkspaceConfirmDialog")),
  CREATE_TEMPLATE: lazy(() => import("./CreateTemplateFormDialog")),
  DELETE_TEMPLATE: lazy(() => import("./DeleteTemplateConfirmDialog")),
  ADD_PROVIDER: EmailProviderFormDialog,
  EDIT_PROVIDER: EmailProviderFormDialog,
  DELETE_PROVIDER: lazy(() =>
    deleteProviderDialogs().then((m) => ({ default: m.DeleteEmailProviderConfirmDialog })),
  ),
  ADD_AI_PROVIDER: lazy(() => import("./AiProviderFormDialog")),
  DELETE_AI_PROVIDER: lazy(() =>
    deleteProviderDialogs().then((m) => ({ default: m.DeleteAiProviderConfirmDialog })),
  ),
};

/**
 * Renders whichever Senlo dialog is open. Mounted once, inside the data and
 * navigation providers (`SenloAppProvider` does it); each dialog loads on
 * first open.
 */
export function SenloDialogHost() {
  return <SenloDialogStore.DialogHost components={components} />;
}
