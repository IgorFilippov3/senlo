// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The read-only canvas, its own entry so the canvas library loads only where
// a preview opens (`LazyWorkflowPreview` imports it on demand).
export { WorkflowPreview, type WorkflowPreviewProps } from "@senlo/automation-builder";
