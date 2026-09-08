import { beforeEach, describe, expect, it } from "vitest";
import { getBlockDefinition } from "@senlo/core";

import { column, design, row, store } from "./fixtures";

/**
 * The property panel writes every field of its form into the block on each
 * keystroke, so what reaches the document - and from there the renderer - is
 * whatever `useBlockForm` hands the store. These tests stand in for that form.
 */
const productLine = {
  id: "pl-1",
  type: "product-line" as const,
  data: { items: [{ left: "DEVICE", right: "Chrome macOS" }] },
};

const render = (block: any) =>
  getBlockDefinition(block.type)!.renderHTML(block, { responsiveStyles: [] });

beforeEach(() => {
  store().resetEditor();
  store().setDesign(design([row("row-1", [column("col-1", [productLine])])]));
});

describe("the padding of a product line", () => {
  it("reaches the document", () => {
    store().updateBlockWithoutHistory("pl-1", {
      items: [{ left: "DEVICE", right: "Chrome macOS" }],
      padding: { top: 14, right: 20, bottom: 14, left: 20 },
    } as any);

    const block: any = store().design.rows[0].columns[0].blocks[0];
    expect(block.data.padding).toEqual({
      top: 14,
      right: 20,
      bottom: 14,
      left: 20,
    });
  });

  it("reaches the markup the canvas and the message share", () => {
    store().updateBlockWithoutHistory("pl-1", {
      padding: { top: 14, right: 20, bottom: 14, left: 20 },
    } as any);

    const html = render(store().design.rows[0].columns[0].blocks[0]);

    expect(html).toContain("padding: 14px 20px 14px 20px");
  });

  it("stays inside the background, which is what makes it inner padding", () => {
    store().updateBlockWithoutHistory("pl-1", {
      padding: { top: 14, right: 20, bottom: 14, left: 20 },
      backgroundColor: "#fafafa",
    } as any);

    const html = render(store().design.rows[0].columns[0].blocks[0]);
    const background = html.indexOf("background-color: #fafafa");
    const padding = html.indexOf("padding: 14px 20px 14px 20px");

    expect(background).toBeGreaterThan(-1);
    expect(padding).toBeGreaterThan(background);
  });

  it("is not the same field as the outer gap", () => {
    store().updateBlockWithoutHistory("pl-1", {
      padding: { top: 14, right: 20, bottom: 14, left: 20 },
      margin: { top: 8, right: 0, bottom: 8, left: 0 },
      backgroundColor: "#fafafa",
    } as any);

    const html = render(store().design.rows[0].columns[0].blocks[0]);
    const gap = html.indexOf("padding: 8px 0px 8px 0px");
    const background = html.indexOf("background-color: #fafafa");
    const inner = html.indexOf("padding: 14px 20px 14px 20px");

    expect(gap).toBeGreaterThan(-1);
    expect(background).toBeGreaterThan(gap);
    expect(inner).toBeGreaterThan(background);
  });
});
