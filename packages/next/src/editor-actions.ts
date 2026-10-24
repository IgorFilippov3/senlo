// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ActionTransport } from "@senlo/features";
import type { SenloEditorActions } from "./actions";

/** The editor's server callbacks, as `EditorLayout` props, over the host's action transport. */
export function createEditorActions(call: ActionTransport) {
  const send =
    <K extends keyof SenloEditorActions>(name: K) =>
    (...args: Parameters<SenloEditorActions[K]>): ReturnType<SenloEditorActions[K]> =>
      call(`editor.${name}`, args) as ReturnType<SenloEditorActions[K]>;

  return {
    onSave: send("save"),
    onSendTest: send("sendTest"),
    onListSavedRows: send("listSavedRows"),
    onSaveRow: send("saveRow"),
    onDeleteSavedRow: send("deleteSavedRow"),
  };
}
