// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

/**
 * Client side of the Next.js adapter. Nothing here may import the server
 * entry at runtime (it pulls `next/headers`); types only.
 */

export { createEditorActions } from "./editor-actions";
export { NextNavigationProvider } from "./navigation";
export { routeError, type RouteErrorBack, type RouteErrorOptions } from "./route-error";
export { SenloAppProvider } from "./app-provider";
export { UnsubscribeScreen, type UnsubscribeScreenProps } from "./unsubscribe-screen";
