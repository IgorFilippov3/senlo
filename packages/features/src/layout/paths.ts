// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Every in-app URL the screens link or navigate to. A host passes its own
 * (e.g. to mount the app under an organization segment); anything it leaves
 * out keeps self-hosted's URL. Public URLs that mail points at (tracking,
 * unsubscribe) are not here: they are fixed.
 */
export interface SenloPaths {
  /** Where a signed-in user lands: picks the remembered workspace. */
  home(): string;
  workspaces(): string;
  providers(): string;
  apiDocs(): string;
  /** A workspace's home page. */
  dashboard(workspaceId: number): string;
  templates(workspaceId: number): string;
  triggers(workspaceId: number): string;
  trigger(workspaceId: number, triggerId: number): string;
  newTrigger(workspaceId: number): string;
  automations(workspaceId: number): string;
  automation(workspaceId: number, workflowId: number): string;
  newAutomation(workspaceId: number): string;
  audience(workspaceId: number): string;
  /** Workspace settings (name, providers). */
  settings(workspaceId: number): string;
  apiKeys(workspaceId: number): string;
  /** The editor; with a trigger, Back returns to it. */
  editor(templateId: number, options?: { campaignId?: number | null }): string;
  /** The workspace a path belongs to, or null outside one. */
  workspaceIdFrom(pathname: string): number | null;
  /** Signed-in pages shown without the sidebar (the editor, the workspace picker). */
  hidesSidebar(pathname: string): boolean;
}

const ws = (id: number) => `/workspace/${id}`;

/** Self-hosted's URLs. */
export const defaultSenloPaths: SenloPaths = {
  home: () => "/home",
  workspaces: () => "/workspaces",
  providers: () => "/providers",
  apiDocs: () => "/api-docs",
  dashboard: (id) => `${ws(id)}/dashboard`,
  templates: (id) => `${ws(id)}/templates`,
  triggers: (id) => `${ws(id)}/triggers`,
  trigger: (id, triggerId) => `${ws(id)}/triggers/${triggerId}`,
  newTrigger: (id) => `${ws(id)}/triggers/new`,
  automations: (id) => `${ws(id)}/automations`,
  automation: (id, workflowId) => `${ws(id)}/automations/${workflowId}`,
  newAutomation: (id) => `${ws(id)}/automations/new`,
  audience: (id) => `${ws(id)}/audience`,
  settings: (id) => `${ws(id)}/settings/general`,
  apiKeys: (id) => `${ws(id)}/settings/keys`,
  editor: (templateId, options) =>
    options?.campaignId ? `/editor/${templateId}?campaignId=${options.campaignId}` : `/editor/${templateId}`,
  workspaceIdFrom: (pathname) => {
    const match = /^\/workspace\/(\d+)(\/|$)/.exec(pathname);
    return match ? Number(match[1]) : null;
  },
  hidesSidebar: (pathname) => pathname.startsWith("/editor") || pathname === "/workspaces",
};

/** `defaultSenloPaths` with the host's overrides. */
export function senloPaths(overrides: Partial<SenloPaths> = {}): SenloPaths {
  return { ...defaultSenloPaths, ...overrides };
}
