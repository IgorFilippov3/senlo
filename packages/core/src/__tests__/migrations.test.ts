// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { emailDesignVersion } from "../emailDesign";
import { migrateEmailDesign, migrateRow } from "../migrations";
import { renderEmailDesign } from "../renderer/renderEmailDesign";

/** A document exactly as version 1 of the editor saved it. */
const legacyDocument = () => ({
  version: 1,
  settings: { contentWidth: 600, fontFamily: "Arial, sans-serif" },
  rows: [
    {
      id: "row-1",
      type: "row",
      settings: {},
      columns: [
        {
          id: "col-1",
          width: 100,
          blocks: [
            { id: "b1", type: "paragraph", data: { text: "Hello" } },
            {
              id: "b2",
              type: "product-line",
              data: {
                leftText: "Mug",
                rightText: "$12.00",
                rightWidth: 120,
                padding: { top: 10, right: 0, bottom: 10, left: 0 },
              },
            },
          ],
        },
      ],
    },
  ],
});

describe("migrateEmailDesign", () => {
  it("turns the old product line pair into a list of one", () => {
    const migrated: any = migrateEmailDesign(legacyDocument());
    const block = migrated.rows[0].columns[0].blocks[1];

    expect(block.data.items).toEqual([{ left: "Mug", right: "$12.00" }]);
    expect(block.data.leftText).toBeUndefined();
    expect(block.data.rightText).toBeUndefined();
  });

  it("keeps every other setting of the block", () => {
    const migrated: any = migrateEmailDesign(legacyDocument());
    const block = migrated.rows[0].columns[0].blocks[1];

    expect(block.data.rightWidth).toBe(120);
    expect(block.data.padding).toEqual({
      top: 10,
      right: 0,
      bottom: 10,
      left: 0,
    });
    expect(block.id).toBe("b2");
  });

  it("leaves the other blocks alone", () => {
    const migrated: any = migrateEmailDesign(legacyDocument());

    expect(migrated.rows[0].columns[0].blocks[0]).toEqual({
      id: "b1",
      type: "paragraph",
      data: { text: "Hello" },
    });
  });

  it("stamps the current version", () => {
    const migrated: any = migrateEmailDesign(legacyDocument());

    expect(migrated.version).toBe(emailDesignVersion);
    expect(emailDesignVersion).toBe(4);
  });

  it("does not touch a document that is already current", () => {
    const current = {
      version: emailDesignVersion,
      settings: {},
      rows: [
        {
          id: "row-1",
          type: "row",
          settings: {},
          columns: [
            {
              id: "col-1",
              width: 100,
              blocks: [
                {
                  id: "b1",
                  type: "product-line",
                  data: { items: [{ left: "Mug", right: "$12.00" }] },
                },
              ],
            },
          ],
        },
      ],
    };

    expect(migrateEmailDesign(current)).toBe(current);
  });

  it("runs twice without changing anything the second time", () => {
    const once: any = migrateEmailDesign(legacyDocument());
    const twice: any = migrateEmailDesign(once);

    expect(twice).toEqual(once);
  });

  it("returns anything that is not a document as it came", () => {
    expect(migrateEmailDesign(null)).toBeNull();
    expect(migrateEmailDesign(undefined)).toBeUndefined();
    expect(migrateEmailDesign({ nonsense: true } as any)).toEqual({
      nonsense: true,
    });
  });

  it("treats a document with no version as the oldest one", () => {
    const noVersion: any = legacyDocument();
    delete noVersion.version;

    const migrated: any = migrateEmailDesign(noVersion);

    expect(migrated.rows[0].columns[0].blocks[1].data.items).toHaveLength(1);
  });
});

describe("the bolder weight", () => {
  /** A version 2 document, which is where `bolder` was still a legal value. */
  const withBolder = (data: any, type = "paragraph") => ({
    version: 2,
    settings: {},
    rows: [
      {
        id: "row-1",
        type: "row",
        settings: {},
        columns: [{ id: "col-1", width: 100, blocks: [{ id: "b1", type, data }] }],
      },
    ],
  });

  const blockOf = (doc: any) => doc.rows[0].columns[0].blocks[0];

  it("becomes bold", () => {
    const migrated: any = migrateEmailDesign(
      withBolder({ text: "Hello", fontWeight: "bolder" }),
    );

    expect(blockOf(migrated).data.fontWeight).toBe("bold");
  });

  it("becomes bold on each column of a product line", () => {
    const migrated: any = migrateEmailDesign(
      withBolder(
        {
          items: [{ left: "Mug", right: "$12.00" }],
          leftStyle: { fontSize: 14, fontWeight: "bolder" },
          rightStyle: { fontSize: 14, fontWeight: "bolder" },
        },
        "product-line",
      ),
    );

    const { data } = blockOf(migrated);
    expect(data.leftStyle).toEqual({ fontSize: 14, fontWeight: "bold" });
    expect(data.rightStyle).toEqual({ fontSize: 14, fontWeight: "bold" });
  });

  it("leaves a weight the panel can show alone", () => {
    const migrated: any = migrateEmailDesign(
      withBolder({ text: "Hello", fontWeight: "normal" }),
    );

    expect(blockOf(migrated).data.fontWeight).toBe("normal");
  });

  it("does not give a block a weight it never had", () => {
    const migrated: any = migrateEmailDesign(withBolder({ text: "Hello" }));

    // Writing the field back unconditionally would put an explicit weight on
    // every block in every document the step passes over.
    expect("fontWeight" in blockOf(migrated).data).toBe(false);
  });

  it("is idempotent, which is what a saved row relies on", () => {
    // `migrateRow` has no version to read, so every step runs over it each
    // time and has to decide for itself whether it applies.
    const once: any = migrateRow({
      id: "row-1",
      type: "row",
      settings: {},
      columns: [
        {
          id: "col-1",
          width: 100,
          blocks: [
            { id: "b1", type: "heading", data: { text: "Hi", fontWeight: "bolder" } },
          ],
        },
      ],
    });
    const twice: any = migrateRow(once);

    expect(once.columns[0].blocks[0].data.fontWeight).toBe("bold");
    expect(twice).toEqual(once);
  });
});

describe("an image's corner radius", () => {
  /** A version 3 document, which is where the radius was still one number. */
  const withRadius = (data: any) => ({
    version: 3,
    settings: {},
    rows: [
      {
        id: "row-1",
        type: "row",
        settings: {},
        columns: [
          { id: "col-1", width: 100, blocks: [{ id: "b1", type: "image", data }] },
        ],
      },
    ],
  });

  const blockOf = (doc: any) => doc.rows[0].columns[0].blocks[0];

  it("becomes four equal corners", () => {
    const migrated: any = migrateEmailDesign(
      withRadius({ src: "https://example.com/a.png", borderRadius: 12 }),
    );

    expect(blockOf(migrated).data.borderRadius).toEqual({
      topLeft: 12,
      topRight: 12,
      bottomRight: 12,
      bottomLeft: 12,
    });
  });

  it("keeps the rest of the image", () => {
    const migrated: any = migrateEmailDesign(
      withRadius({
        src: "https://example.com/a.png",
        alt: "A picture",
        width: 320,
        borderRadius: 8,
      }),
    );

    const { data } = blockOf(migrated);
    expect(data.src).toBe("https://example.com/a.png");
    expect(data.alt).toBe("A picture");
    expect(data.width).toBe(320);
  });

  it("does not give an image a radius it never had", () => {
    const migrated: any = migrateEmailDesign(
      withRadius({ src: "https://example.com/a.png" }),
    );

    expect("borderRadius" in blockOf(migrated).data).toBe(false);
  });

  it("drops a radius of zero rather than storing four zeroes", () => {
    const migrated: any = migrateEmailDesign(
      withRadius({ src: "https://example.com/a.png", borderRadius: 0 }),
    );

    expect("borderRadius" in blockOf(migrated).data).toBe(false);
  });

  it("leaves corners that are already corners alone", () => {
    const corners = {
      topLeft: 16,
      topRight: 0,
      bottomRight: 16,
      bottomLeft: 0,
    };
    const migrated: any = migrateEmailDesign(
      withRadius({ src: "https://example.com/a.png", borderRadius: corners }),
    );

    expect(blockOf(migrated).data.borderRadius).toEqual(corners);
  });

  it("is idempotent, which is what a saved row relies on", () => {
    const once: any = migrateRow({
      id: "row-1",
      type: "row",
      settings: {},
      columns: [
        {
          id: "col-1",
          width: 100,
          blocks: [
            {
              id: "b1",
              type: "image",
              data: { src: "https://example.com/a.png", borderRadius: 10 },
            },
          ],
        },
      ],
    });
    const twice: any = migrateRow(once);

    expect(once.columns[0].blocks[0].data.borderRadius).toEqual({
      topLeft: 10,
      topRight: 10,
      bottomRight: 10,
      bottomLeft: 10,
    });
    expect(twice).toEqual(once);
  });
});

describe("migrateRow", () => {
  it("converts a saved row, which carries no version of its own", () => {
    const saved = legacyDocument().rows[0];

    const migrated: any = migrateRow(saved);

    expect(migrated.columns[0].blocks[1].data.items).toEqual([
      { left: "Mug", right: "$12.00" },
    ]);
  });

  it("leaves a row that is already current alone", () => {
    const saved: any = migrateRow(legacyDocument().rows[0]);
    const again: any = migrateRow(saved);

    expect(again).toEqual(saved);
  });
});

describe("rendering a stored document", () => {
  it("migrates on the way in, so an old template still sends", () => {
    const html = renderEmailDesign(legacyDocument() as any);

    expect(html).toContain("Mug");
    expect(html).toContain("$12.00");
  });
});
