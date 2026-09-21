import { beforeEach, describe, expect, it, vi } from "vitest";

import { emailDesignVersion } from "@senlo/core";

import { savedRow, store } from "./fixtures";

/**
 * The editor is one of the two doors a stored document comes through, so it
 * reshapes what it is given rather than trusting the caller.
 */
const legacyDesign = () => ({
  version: 1,
  settings: {},
  rows: [
    {
      id: "row-1",
      type: "row" as const,
      settings: {},
      columns: [
        {
          id: "col-1",
          width: 100,
          blocks: [
            {
              id: "pl-1",
              type: "product-line" as const,
              data: { leftText: "DEVICE", rightText: "Chrome macOS" },
            },
          ],
        },
      ],
    },
  ],
});

beforeEach(() => {
  store().resetEditor();
});

describe("loading an older document", () => {
  it("turns a product line pair into a list", () => {
    store().setDesign(legacyDesign() as any);

    const block: any = store().design.rows[0].columns[0].blocks[0];
    expect(block.data.items).toEqual([
      { left: "DEVICE", right: "Chrome macOS" },
    ]);
    expect(block.data.leftText).toBeUndefined();
  });

  it("stamps the current version", () => {
    store().setDesign(legacyDesign() as any);

    // Against the constant, not a literal: this asserts that the editor stamps
    // whatever the current version is, which is the actual contract. A literal
    // here just breaks on every bump.
    expect(store().design.version).toBe(emailDesignVersion);
  });

  it("is not an edit: the template is not marked unsaved", () => {
    store().setDesign(legacyDesign() as any);

    expect(store().isDirty).toBe(false);
    expect(store().historyPast).toHaveLength(0);
  });

  it("reshapes what the AI returns too", () => {
    store().setDesign(legacyDesign() as any);
    store().updateDesignFromAi(legacyDesign() as any);

    const block: any = store().design.rows[0].columns[0].blocks[0];
    expect(block.data.items).toHaveLength(1);
  });
});

describe("the saved-row library", () => {
  it("reshapes a row stored before the list existed", async () => {
    const legacyRow = savedRow({
      data: legacyDesign().rows[0],
    });
    store().setSavedRowCallbacks({
      onList: vi.fn().mockResolvedValue([legacyRow]),
    });

    await store().loadSavedRows();

    const block = store().savedRows[0].data.columns[0].blocks[0];
    expect(block.data.items).toEqual([
      { left: "DEVICE", right: "Chrome macOS" },
    ]);
  });

  it("carries the converted row into the document", async () => {
    store().setSavedRowCallbacks({
      onList: vi.fn().mockResolvedValue([savedRow({ data: legacyDesign().rows[0] })]),
    });
    await store().loadSavedRows();

    store().addSavedRowToDesign(store().savedRows[0]);

    const block: any = store().design.rows[0].columns[0].blocks[0];
    expect(block.data.items).toHaveLength(1);
  });
});
