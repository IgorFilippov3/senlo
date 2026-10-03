// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import type { RenderContext } from "../../renderer/types";
import { getBlockDefinition } from "../registry";
import { tableBlockDataSchema } from "../table";

const definition = getBlockDefinition("table")!;

const render = (data: any, context?: Partial<RenderContext>) =>
  definition.renderHTML(
    { id: "t1", type: "table", data },
    { responsiveStyles: [], ...context } as RenderContext,
  );

const COLUMNS = [
  { key: "description", label: "Description", width: 50, align: "left" as const },
  { key: "qty", label: "Qty", width: 20, align: "right" as const },
  { key: "amount", label: "Amount", width: 30, align: "right" as const },
];

const ITEMS = [
  { description: "Pro subscription", qty: "1", amount: "$29.00" },
  { description: "Additional seats", qty: "8", amount: "$96.00" },
];

const bodyRowCount = (html: string) =>
  (html.match(/<tr>/g) || []).length;

describe("rows from data", () => {
  const fromData = (items: unknown, data: any = {}) =>
    render(
      { columns: COLUMNS, source: "custom.items", ...data },
      { options: { data: { custom: { items } } } as any },
    );

  it("renders one row per item, taking each cell by its column's key", () => {
    const html = fromData(ITEMS);

    expect(html).toContain("Pro subscription");
    expect(html).toContain("$96.00");
    // two items plus the header
    expect(bodyRowCount(html)).toBe(3);
  });

  it("leaves a cell empty when the item has no such field", () => {
    const html = fromData([{ description: "Only this" }]);

    expect(html).toContain("Only this");
    expect(html).not.toContain("undefined");
  });

  it("does not put an object or an array into a cell", () => {
    const html = fromData([{ description: { nested: true }, qty: [1, 2] }]);

    expect(html).not.toContain("[object");
    expect(html).not.toContain("nested");
  });

  it("escapes a value so it cannot be read back as a merge tag", () => {
    // The substitution pass runs over the finished document, so a value that
    // happens to contain braces must not survive as one.
    const html = fromData([{ description: "{{contact.email}}" }]);

    expect(html).not.toContain("{{contact.email}}");
    expect(html).toContain("&#123;");
  });

  it("escapes markup in a recipient's value", () => {
    const html = fromData([{ description: "<b>bold</b>" }]);

    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("reads an alias from an enclosing loop", () => {
    const html = render(
      { columns: COLUMNS, source: "order.lines" },
      {
        options: { data: {} } as any,
        localData: { order: { lines: [{ description: "From the loop" }] } },
      },
    );

    expect(html).toContain("From the loop");
  });
});

describe("an unresolved source", () => {
  it("shows the shape of the table in the canvas, where there is no data", () => {
    // An author who has just dragged a table in should see its columns rather
    // than an empty box.
    const html = render({ columns: COLUMNS, source: "custom.items" });

    expect(html).toContain("Description");
    expect(bodyRowCount(html)).toBeGreaterThan(1);
  });

  it("renders no rows at all in a message being sent", () => {
    const html = render(
      { columns: COLUMNS, source: "custom.items" },
      { options: { data: { custom: {} } } as any },
    );

    // The header, and nothing else. A sent message never shows placeholders.
    expect(bodyRowCount(html)).toBe(1);
  });
});

describe("rows typed in the panel", () => {
  it("renders them positionally", () => {
    const html = render({
      columns: COLUMNS,
      rows: [["Item", "2", "$4.00"]],
    });

    expect(html).toContain("Item");
    expect(html).toContain("$4.00");
  });

  it("pads a short row rather than shifting its cells left", () => {
    const html = render({ columns: COLUMNS, rows: [["Only"]] });
    const cells = html.match(/<td[^>]*>/g) || [];

    // three header cells and three body cells, not four
    expect(cells).toHaveLength(6);
  });

  it("keeps a typed cell as markup, because the author wrote it", () => {
    const html = render({ columns: COLUMNS, rows: [["<b>Bold</b>", "", ""]] });

    expect(html).toContain("<b>Bold</b>");
  });
});

describe("the header", () => {
  it("is a row of the same table, not a thing of its own", () => {
    const html = render({ columns: COLUMNS, rows: [["a", "b", "c"]] });

    expect(html).toContain("Description");
    expect(bodyRowCount(html)).toBe(2);
  });

  it("goes away entirely when it is turned off", () => {
    const html = render({
      columns: COLUMNS,
      showHeader: false,
      rows: [["a", "b", "c"]],
    });

    expect(html).not.toContain("Description");
    expect(bodyRowCount(html)).toBe(1);
  });
});

describe("the rules", () => {
  it("draws one between rows and none under the last", () => {
    const html = render({
      columns: COLUMNS,
      rows: [["a", "", ""], ["b", "", ""], ["c", "", ""]],
      rowDivider: { width: 2, style: "solid", color: "#111111" },
      showHeader: false,
    });

    // Three rows, two gaps, three cells per gap.
    expect(
      (html.match(/border-bottom: 2px solid #111111/g) || []).length,
    ).toBe(6);
  });

  it("draws nothing for a rule of zero width", () => {
    const html = render({
      columns: COLUMNS,
      rows: [["a", "", ""], ["b", "", ""]],
      rowDivider: { width: 0 },
      headerDivider: { width: 0 },
    });

    expect(html).not.toContain("border-bottom:");
  });
});

describe("the columns", () => {
  it("reach both the attribute and the style", () => {
    const html = render({ columns: COLUMNS, rows: [["a", "b", "c"]] });

    expect(html).toContain('width="50%"');
    expect(html).toContain("width: 50%");
    expect(html).toContain("text-align: right");
  });

  it("survive a block with no columns at all", () => {
    expect(() => render({})).not.toThrow();
  });
});

describe("a column's own type", () => {
  const styled = [
    { key: "l", width: 55, align: "right" as const, style: { color: "#71717a" } },
    { key: "r", width: 45, align: "right" as const, style: { fontWeight: "bold" as const } },
  ];

  it("lays only what it names over the table's", () => {
    // The first column takes a colour and keeps the table's size; the second
    // takes a weight and keeps the table's colour.
    const html = render({
      columns: styled,
      textStyle: { fontSize: 13, color: "#27272a" },
      rows: [["Subtotal", "$1,240.00"]],
      showHeader: false,
    });

    expect(html).toContain("color: #71717a");
    expect(html).toContain("font-weight: bold");
    expect(html).toContain("color: #27272a");
    // Neither column asked for a different size.
    expect((html.match(/font-size: 13px/g) || []).length).toBe(2);
  });

  it("leaves the header alone, which is styled as a band", () => {
    const html = render({
      columns: styled,
      headerStyle: { color: "#ffffff", fontWeight: "bold" },
      headerBackgroundColor: "#4a7c2f",
      rows: [["a", "b"]],
    });

    const header = html.slice(html.indexOf("<tr>"), html.indexOf("</tr>"));
    expect(header).toContain("color: #ffffff");
    expect(header).not.toContain("color: #71717a");
  });

  it("colours a link the author typed to match its column", () => {
    const html = render({
      columns: styled,
      rows: [['<a href="https://example.com">terms</a>', "x"]],
      showHeader: false,
    });

    expect(html).toContain("color: #71717a");
  });

  it("changes nothing for a table whose columns name no type", () => {
    const plain = { columns: [{ key: "a" }], rows: [["one"]], showHeader: false };
    const withEmpty = {
      columns: [{ key: "a", style: {} }],
      rows: [["one"]],
      showHeader: false,
    };

    expect(render(withEmpty)).toBe(render(plain));
  });
});

describe("the narrow screen", () => {
  it("adds one rule and one class when a phone size is set", () => {
    const context: RenderContext = { responsiveStyles: [] };
    const html = definition.renderHTML(
      { id: "t1", type: "table", data: { columns: COLUMNS, mobileFontSize: 11 } },
      context,
    );

    expect(context.responsiveStyles).toHaveLength(1);
    expect(context.responsiveStyles[0]).toContain("@media");
    expect(context.responsiveStyles[0]).toContain("font-size: 11px !important;");
    // The cells, not the table. Each cell carries its own inline size, and an
    // inherited one cannot beat it however important the ancestor's rule is -
    // which is what made this setting do nothing the first time it was built.
    expect(context.responsiveStyles[0]).toMatch(/\.senlo-tbl-[a-z0-9]+ td \{/);

    const named = /\.(senlo-tbl-[a-z0-9]+)/.exec(context.responsiveStyles[0] ?? "")?.[1] ?? "";
    expect(named).not.toBe("");
    expect(html).toContain(`class="${named}"`);
  });

  it("adds neither when it is not set", () => {
    const context: RenderContext = { responsiveStyles: [] };
    const html = definition.renderHTML(
      { id: "t1", type: "table", data: { columns: COLUMNS } },
      context,
    );

    expect(context.responsiveStyles).toHaveLength(0);
    expect(html).not.toContain("senlo-tbl-");
  });
});

describe("the schema", () => {
  it("wants at least one column", () => {
    expect(tableBlockDataSchema.safeParse({ columns: [] }).success).toBe(false);
    expect(
      tableBlockDataSchema.safeParse({ columns: [{ key: "a" }] }).success,
    ).toBe(true);
  });

  it("takes either source of rows", () => {
    expect(
      tableBlockDataSchema.safeParse({
        columns: [{ key: "a" }],
        source: "custom.items",
      }).success,
    ).toBe(true);
    expect(
      tableBlockDataSchema.safeParse({
        columns: [{ key: "a" }],
        rows: [["one"], ["two"]],
      }).success,
    ).toBe(true);
  });
});

describe("the MJML export", () => {
  it("carries a column's own colour", () => {
    const mjml = definition.renderMJML(
      {
        id: "t1",
        type: "table",
        data: {
          columns: [{ key: "l", style: { color: "#71717a" } }, { key: "r" }],
          rows: [["Subtotal", "$1,240.00"]],
          showHeader: false,
        },
      },
      undefined,
    );

    expect(mjml).toContain("color: #71717a");
  });

  it("uses mj-table and carries the typed rows", () => {
    const mjml = definition.renderMJML(
      { id: "t1", type: "table", data: { columns: COLUMNS, rows: [["Item", "1", "$4"]] } },
      undefined,
    );

    expect(mjml).toContain("<mj-table");
    expect(mjml).toContain("Description");
    expect(mjml).toContain("Item");
  });
});
