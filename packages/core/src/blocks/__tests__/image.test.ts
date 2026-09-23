// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { RenderContext } from "../../renderer/types";
import { getBlockDefinition } from "../registry";
import { imageBlockDataSchema } from "../image";

const context: RenderContext = { responsiveStyles: [] };

const SRC = "https://example.com/a.png";

function render(data: Record<string, any>): string {
  const definition = getBlockDefinition("image")!;
  return definition.renderHTML({ id: "b1", type: "image", data }, context);
}

function renderMJML(data: Record<string, any>): string {
  const definition = getBlockDefinition("image")!;
  return definition.renderMJML({ id: "b1", type: "image", data }, undefined);
}

describe("an image's corner radius", () => {
  it("is one value when every corner is the same", () => {
    const html = render({
      src: SRC,
      borderRadius: {
        topLeft: 12,
        topRight: 12,
        bottomRight: 12,
        bottomLeft: 12,
      },
    });

    expect(html).toContain("border-radius: 12px;");
    expect(html).not.toContain("12px 12px");
  });

  it("is written clockwise from the top left when the corners differ", () => {
    // The one mistake here that no uniform preview would show: CSS writes
    // top-left, top-right, bottom-right, bottom-left, which is not the order
    // the panel lays the inputs out in.
    const html = render({
      src: SRC,
      borderRadius: {
        topLeft: 1,
        topRight: 2,
        bottomRight: 3,
        bottomLeft: 4,
      },
    });

    expect(html).toContain("border-radius: 1px 2px 3px 4px;");
  });

  it("renders an untouched image exactly as it did before corners existed", () => {
    // Every document written before this feature has no radius at all, and
    // what it rendered to is what it still has to render to.
    expect(render({ src: SRC })).toContain("border-radius: 0px;");
  });

  it("reads a radius that never went through the migration", () => {
    // A payload can reach the renderer stamped with the current version and a
    // plain number inside it - the AI endpoint and the public API both
    // validate against the same union - and `migrateEmailDesign` will not
    // reshape a document that is not behind.
    expect(render({ src: SRC, borderRadius: 20 })).toContain(
      "border-radius: 20px;",
    );
  });

  it("says the same thing in MJML", () => {
    const uniform = renderMJML({
      src: SRC,
      borderRadius: { topLeft: 6, topRight: 6, bottomRight: 6, bottomLeft: 6 },
    });
    const mixed = renderMJML({
      src: SRC,
      borderRadius: { topLeft: 6, topRight: 6, bottomRight: 0, bottomLeft: 0 },
    });

    expect(uniform).toContain('border-radius="6px"');
    expect(mixed).toContain('border-radius="6px 6px 0px 0px"');
    expect(renderMJML({ src: SRC })).toContain('border-radius="0px"');
  });

  it("accepts both shapes on the way in", () => {
    expect(
      imageBlockDataSchema.safeParse({ src: SRC, borderRadius: 8 }).success,
    ).toBe(true);
    expect(
      imageBlockDataSchema.safeParse({
        src: SRC,
        borderRadius: { topLeft: 8, bottomRight: 4 },
      }).success,
    ).toBe(true);
    expect(
      imageBlockDataSchema.safeParse({ src: SRC, borderRadius: -1 }).success,
    ).toBe(false);
  });
});
