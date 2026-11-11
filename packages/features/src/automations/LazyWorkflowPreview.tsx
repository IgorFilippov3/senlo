// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { Suspense, lazy } from "react";
import type { WorkflowPreviewProps } from "../workflow-preview";

const Preview = lazy(() => import("../workflow-preview").then((m) => ({ default: m.WorkflowPreview })));

/**
 * The read-only workflow canvas, loaded when it is first shown: pages with a
 * gallery or an import dialog do not carry the canvas library until then.
 */
export function LazyWorkflowPreview(props: WorkflowPreviewProps) {
  return (
    <Suspense fallback={<div className={`h-[420px] w-full rounded-lg bg-gray-100 animate-pulse ${props.className ?? ""}`} />}>
      <Preview {...props} />
    </Suspense>
  );
}
