import { describe, it, expect } from "vitest";
import type { EmailDesignDocument, RowBlock } from "../../emailDesign";
import { renderEmailDesign } from "../renderEmailDesign";

function row(blocks: RowBlock["columns"][number]["blocks"]): RowBlock {
  return {
    id: "row-1",
    type: "row",
    columns: [{ id: "col-1", width: 100, blocks }],
    settings: { backgroundColor: "#ffffff", align: "center" },
  };
}

function doc(rows: RowBlock[]): EmailDesignDocument {
  return {
    version: 1,
    rows,
    settings: {
      backgroundColor: "#f5f5f5",
      contentWidth: 600,
      fontFamily: "Arial, sans-serif",
      textColor: "#111827",
    },
  };
}

/** One row holding every block type the renderer supports. */
const allBlocksDocument: EmailDesignDocument = doc([
  row([
    { id: "b1", type: "heading", data: { text: "Order confirmed", level: 1 } },
    {
      id: "b2",
      type: "paragraph",
      data: { text: "Thanks for your <strong>order</strong>." },
    },
    {
      id: "b3",
      type: "image",
      data: { src: "/uploads/logo.png", alt: "Senlo", width: 200 },
    },
    {
      id: "b4",
      type: "button",
      data: { text: "Track it", href: "https://senlo.io/track" },
    },
    { id: "b5", type: "spacer", data: { height: 24 } },
    {
      id: "b6",
      type: "list",
      data: { items: ["One", "Two"], listType: "unordered" },
    },
    { id: "b7", type: "divider", data: { color: "#cccccc", width: 80 } },
    {
      id: "b8",
      type: "product-line",
      data: { leftText: "Mug", rightText: "$12.00" },
    },
    {
      id: "b9",
      type: "socials",
      data: {
        links: [
          {
            type: "github",
            url: "https://github.com/IgorFilippov3/senlo",
            icon: "/icons/github.png",
          },
        ],
      },
    },
  ]),
]);

describe("renderEmailDesign", () => {
  it("renders every block type (snapshot)", () => {
    expect(
      renderEmailDesign(allBlocksDocument, { baseUrl: "https://senlo.io" }),
    ).toMatchSnapshot();
  });

  it("produces a complete document", () => {
    const html = renderEmailDesign(allBlocksDocument);
    expect(html.startsWith("<!DOCTYPE html")).toBe(true);
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("resolves relative asset paths against the base URL", () => {
    const html = renderEmailDesign(allBlocksDocument, {
      baseUrl: "https://senlo.io",
    });
    expect(html).toContain('src="https://senlo.io/uploads/logo.png"');
  });

  describe("merge tags", () => {
    it("substitutes contact data", () => {
      const html = renderEmailDesign(
        doc([
          row([
            {
              id: "b1",
              type: "paragraph",
              data: { text: "Hi {{contact.first_name}}" },
            },
          ]),
        ]),
        { data: { contact: { first_name: "Ann" } } },
      );

      expect(html).toContain("Hi Ann");
    });

    it("does not let contact data inject markup", () => {
      const html = renderEmailDesign(
        doc([
          row([
            {
              id: "b1",
              type: "paragraph",
              data: { text: "Hi {{contact.first_name}}" },
            },
          ]),
        ]),
        {
          data: {
            contact: { first_name: '</p><script>alert(1)</script><p>' },
          },
        },
      );

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("does not let contact data inject an event handler into a link", () => {
      const html = renderEmailDesign(
        doc([
          row([
            {
              id: "b1",
              type: "button",
              data: { text: "Go", href: "{{contact.url}}" },
            },
          ]),
        ]),
        { data: { contact: { url: '" onclick="alert(1)' } } },
      );

      expect(html).not.toContain('onclick="alert(1)"');
    });

    it("neutralizes a javascript: URL delivered through a merge tag", () => {
      const html = renderEmailDesign(
        doc([
          row([
            {
              id: "b1",
              type: "button",
              data: { text: "Go", href: "{{contact.url}}" },
            },
          ]),
        ]),
        { data: { contact: { url: "javascript:alert(1)" } } },
      );

      expect(html).not.toContain("javascript:");
    });

    it("neutralizes a javascript: URL written into the template itself", () => {
      const html = renderEmailDesign(
        doc([
          row([
            {
              id: "b1",
              type: "button",
              data: { text: "Go", href: "javascript:alert(1)" },
            },
          ]),
        ]),
      );

      expect(html).not.toContain("javascript:");
      expect(html).toContain('href="#"');
    });

    it("keeps a font family from escaping the style block", () => {
      const design = doc([row([])]);
      design.settings.fontFamily = 'Arial</style><script>alert(1)</script>';
      const html = renderEmailDesign(design);

      expect(html).not.toContain("<script>");
      expect(html).not.toContain("</style><");
    });
  });

  describe("conditions", () => {
    const conditionalDoc = (value: string) =>
      renderEmailDesign(
        doc([
          row([
            {
              id: "b1",
              type: "paragraph",
              data: { text: "VIP treatment" },
              condition: {
                variable: "contact.plan",
                operator: "equals",
                value: "pro",
              },
            },
          ]),
        ]),
        { data: { contact: { plan: value } } },
      );

    it("keeps the block when the condition matches", () => {
      expect(conditionalDoc("pro")).toContain("VIP treatment");
    });

    it("drops the block when it does not", () => {
      expect(conditionalDoc("free")).not.toContain("VIP treatment");
    });
  });

  describe("loops", () => {
    const loopDocument = (): EmailDesignDocument => {
      const r = row([
        { id: "b1", type: "paragraph", data: { text: "{{item.title}}" } },
      ]);
      r.loop = { variable: "custom.items", alias: "item" };
      return doc([r]);
    };

    it("repeats the row once per array element", () => {
      const html = renderEmailDesign(loopDocument(), {
        data: { custom: { items: [{ title: "Mug" }, { title: "Shirt" }] } },
      });

      expect(html).toContain("Mug");
      expect(html).toContain("Shirt");
    });

    it("escapes values inside a loop too", () => {
      const html = renderEmailDesign(loopDocument(), {
        data: { custom: { items: [{ title: "<script>alert(1)</script>" }] } },
      });

      expect(html).not.toContain("<script>");
    });

    it("renders nothing when the loop variable is not an array", () => {
      const html = renderEmailDesign(loopDocument(), {
        data: { custom: { items: "not-an-array" } },
      });

      expect(html).not.toContain("{{item.title}}");
    });
  });
});
