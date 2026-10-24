// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { defaultSenloPaths, senloPaths } from "@senlo/features";
import { routeErrorBackLink } from "../route-error";

describe("routeErrorBackLink", () => {
  it("has no way back unless asked", () => {
    expect(routeErrorBackLink(undefined, defaultSenloPaths, 4)).toBeUndefined();
  });

  it("goes to the workspace's dashboard or triggers inside a workspace", () => {
    expect(routeErrorBackLink("workspace", defaultSenloPaths, 4)).toEqual({
      href: "/workspace/4/dashboard",
      label: "Back to dashboard",
    });
    expect(routeErrorBackLink("triggers", defaultSenloPaths, 4)).toEqual({
      href: "/workspace/4/triggers",
      label: "Back to triggers",
    });
  });

  it("falls back to the workspaces list outside a workspace", () => {
    expect(routeErrorBackLink("triggers", defaultSenloPaths, null)).toEqual({
      href: "/workspaces",
      label: "Back to workspaces",
    });
  });

  it("uses the host's paths", () => {
    const paths = senloPaths({ dashboard: (id) => `/o/acme/w/${id}` });
    expect(routeErrorBackLink("workspace", paths, 4)?.href).toBe("/o/acme/w/4");
  });
});
