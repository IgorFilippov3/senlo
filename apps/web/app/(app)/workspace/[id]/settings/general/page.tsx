// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { WorkspaceSettingsScreen } from "@senlo/features";

export default function GeneralSettingsPage() {
  return (
    <WorkspaceSettingsScreen
      retentionNote={
        <p className="text-xs text-zinc-500">
          Set on the server with <code className="font-mono">LOG_RETENTION_DAYS</code>; unset keeps everything.
        </p>
      }
    />
  );
}
