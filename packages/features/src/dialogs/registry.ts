// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import type { Campaign, EmailTemplate, Project, PublicEmailProvider } from "@senlo/core";
import { createDialogs } from "../shared/dialogs";

/**
 * Every dialog the screens open, with the props each takes. One store for
 * the app: a dialog opened from a page lives in `SenloDialogHost`, above the
 * pages, so it survives the page under it going away (deleting a workspace).
 *
 * A host with dialogs of its own makes its own store with `createDialogs`
 * and renders its own `DialogHost` next to this one.
 */
export interface SenloDialogProps {
  EDIT_TRIGGER_CONFIG: { campaign: Campaign; project: Project; template: EmailTemplate };
  DELETE_TRIGGER: { campaign: Campaign };
  CREATE_WORKSPACE: Record<string, never>;
  DELETE_WORKSPACE: { project: Project };
  CREATE_TEMPLATE: { projectId: number };
  DELETE_TEMPLATE: { template: EmailTemplate; projectId: number };
  ADD_PROVIDER: Record<string, never>;
  EDIT_PROVIDER: { provider: PublicEmailProvider };
  DELETE_PROVIDER: { providerId: number; name: string };
  ADD_AI_PROVIDER: Record<string, never>;
  DELETE_AI_PROVIDER: { providerId: number; name: string };
}

export type SenloDialogName = keyof SenloDialogProps;

const store = createDialogs<SenloDialogProps>();

/** `open(name, props)` and `close()`; both stable. */
export const useSenloDialogs = store.useDialogs;

export const SenloDialogStore = store;
