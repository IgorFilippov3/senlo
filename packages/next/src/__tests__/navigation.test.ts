// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  defaultSenloPaths,
  globalNavItemsFor,
  isNavItemActive,
  isSidebarHidden,
  mainNavItemsFor,
  senloPaths,
  workspaceHomePath,
  workspaceIdFromPath,
  workspaceNavItems,
} from "@senlo/features";

describe("defaultSenloPaths", () => {
  it("are self-hosted's URLs", () => {
    const p = defaultSenloPaths;
    expect([p.home(), p.workspaces(), p.providers(), p.apiDocs()]).toEqual([
      "/home",
      "/workspaces",
      "/providers",
      "/api-docs",
    ]);
    expect(p.dashboard(4)).toBe("/workspace/4/dashboard");
    expect(p.trigger(4, 9)).toBe("/workspace/4/triggers/9");
    expect(p.newTrigger(4)).toBe("/workspace/4/triggers/new");
    expect(p.automation(4, 2)).toBe("/workspace/4/automations/2");
    expect(p.settings(4)).toBe("/workspace/4/settings/general");
    expect(p.apiKeys(4)).toBe("/workspace/4/settings/keys");
    expect(p.editor(12)).toBe("/editor/12");
    expect(p.editor(12, { campaignId: 3 })).toBe("/editor/12?campaignId=3");
    expect(p.editor(12, { campaignId: null })).toBe("/editor/12");
  });

  it("find the workspace in a path and the pages without a sidebar", () => {
    expect(defaultSenloPaths.workspaceIdFrom("/workspace/12/triggers")).toBe(12);
    expect(defaultSenloPaths.workspaceIdFrom("/workspace/12")).toBe(12);
    expect(defaultSenloPaths.workspaceIdFrom("/workspaces")).toBeNull();
    expect(defaultSenloPaths.hidesSidebar("/editor/5")).toBe(true);
    expect(defaultSenloPaths.hidesSidebar("/workspaces")).toBe(true);
    expect(defaultSenloPaths.hidesSidebar("/workspace/5/dashboard")).toBe(false);
  });

  it("back the old helpers, which keep their answers", () => {
    expect(workspaceHomePath(3)).toBe("/workspace/3/dashboard");
    expect(workspaceIdFromPath("/workspace/3/audience")).toBe(3);
    expect(isSidebarHidden("/editor/1")).toBe(true);
  });
});

describe("nav items", () => {
  it("mark the right workspace item active at the default URLs", () => {
    const items = workspaceNavItems(5);
    const active = (pathname: string) =>
      items.filter((item) => isNavItemActive(item, pathname)).map((item) => item.label);

    expect(active("/workspace/5/dashboard")).toEqual(["Dashboard"]);
    expect(active("/workspace/5/triggers/9")).toEqual(["Triggers"]);
    expect(active("/workspace/5/settings/general")).toEqual(["Settings"]);
    expect(active("/workspace/5/settings/keys")).toEqual(["API Keys"]);
  });

  it("follow a host's own paths", () => {
    const paths = senloPaths({
      dashboard: (id) => `/o/acme/w/${id}`,
      workspaces: () => "/o/acme",
      providers: () => "/o/acme/providers",
    });

    expect(paths.templates(5)).toBe("/workspace/5/templates");
    expect(workspaceNavItems(5, paths)[0].href).toBe("/o/acme/w/5");
    expect(globalNavItemsFor(paths).map((item) => item.href)).toEqual([
      "/o/acme",
      "/o/acme/providers",
      "/api-docs",
    ]);
    expect(isNavItemActive(mainNavItemsFor(paths)[0], "/o/acme")).toBe(true);
    expect(isNavItemActive(mainNavItemsFor(paths)[0], "/o/acme/providers")).toBe(false);
  });
});
