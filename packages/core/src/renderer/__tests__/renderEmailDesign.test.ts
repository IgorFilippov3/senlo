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
      data: { items: [{ left: "Mug", right: "$12.00" }] },
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

describe("email client correctness", () => {
  const textDoc = doc([
    row([
      { id: "b1", type: "heading", data: { text: "Hello", level: 1 } },
      { id: "b2", type: "paragraph", data: { text: "Body copy" } },
      {
        id: "b3",
        type: "list",
        data: { items: ["One"], listType: "unordered" },
      },
    ]),
  ]);

  it("writes the font family inline on every text block", () => {
    const design = doc([...textDoc.rows]);
    design.settings.fontFamily = "Georgia, serif";
    const html = renderEmailDesign(design);

    // Outlook ignores the * selector in the head, so once in <style> is not
    // enough: heading, paragraph and list each need their own declaration.
    const inline = html.match(/font-family: Georgia, serif/g) || [];
    expect(inline.length).toBeGreaterThanOrEqual(3);
  });

  it("applies the global text colour", () => {
    const design = doc([...textDoc.rows]);
    design.settings.textColor = "#123456";

    expect(renderEmailDesign(design)).toContain("color: #123456");
  });

  it("lets a block override the global text colour", () => {
    const design = doc([
      row([
        {
          id: "b1",
          type: "paragraph",
          data: { text: "Body", color: "#ff0000" },
        },
      ]),
    ]);
    design.settings.textColor = "#123456";

    expect(renderEmailDesign(design)).toContain("color: #ff0000");
  });

  it("applies the row padding exactly once", () => {
    const design = doc([
      {
        id: "row-1",
        type: "row",
        columns: [{ id: "col-1", width: 100, blocks: [] }],
        settings: { padding: { top: 20, right: 20, bottom: 20, left: 20 } },
      },
    ]);

    // The old shape put the same declaration on an mso <td> and on the inner
    // div, so Outlook padded the row twice.
    const occurrences =
      renderEmailDesign(design).match(/padding: 20px 20px 20px 20px/g) || [];
    expect(occurrences).toHaveLength(1);
  });

  it("gives the button a VML fallback for Outlook", () => {
    const html = renderEmailDesign(
      doc([
        row([
          {
            id: "b1",
            type: "button",
            data: { text: "Track it", href: "https://senlo.io/track" },
          },
        ]),
      ]),
    );

    expect(html).toContain("v:roundrect");
    expect(html).toContain("<w:anchorlock/>");
    // The VML block is Outlook-only and the anchor is hidden from Outlook, so
    // the button never renders twice.
    expect(html).toContain("<!--[if mso]>");
    expect(html).toContain("<!--[if !mso]><!-->");
  });

  it("does not put markup inside the VML label", () => {
    const html = renderEmailDesign(
      doc([
        row([
          {
            id: "b1",
            type: "button",
            data: { text: "Buy <strong>now</strong>", href: "https://senlo.io" },
          },
        ]),
      ]),
    );

    expect(html).toContain("<center style=");
    expect(html).toMatch(/<center[^>]*>Buy now<\/center>/);
  });
});

describe("preheader and title", () => {
  const simple = doc([
    row([{ id: "b1", type: "paragraph", data: { text: "Body" } }]),
  ]);

  it("hides the preheader from the rendered message", () => {
    const html = renderEmailDesign(simple, {
      preheader: "Your order is on its way",
    });

    expect(html).toContain("Your order is on its way");
    expect(html).toContain("mso-hide: all");
    expect(html).toContain("display: none");
  });

  it("escapes the preheader", () => {
    const html = renderEmailDesign(simple, {
      preheader: "<script>alert(1)</script>",
    });

    expect(html).not.toContain("<script>");
  });

  it("adds nothing when there is no preheader", () => {
    expect(renderEmailDesign(simple)).not.toContain("mso-hide");
    expect(renderEmailDesign(simple, { preheader: "   " })).not.toContain(
      "mso-hide",
    );
  });

  it("fills the title when one is given", () => {
    expect(renderEmailDesign(simple, { title: "Order #12" })).toContain(
      "<title>Order #12</title>",
    );
  });
});

describe("loop limits", () => {
  const loopDoc = () => {
    const r = row([
      { id: "b1", type: "paragraph", data: { text: "{{item.n}}" } },
    ]);
    r.loop = { variable: "custom.items", alias: "item" };
    return doc([r]);
  };

  it("stops repeating a row past the limit", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ n: i }));
    const html = renderEmailDesign(loopDoc(), {
      maxLoopIterations: 10,
      data: { custom: { items } },
    });

    expect(html).toContain(">9<");
    expect(html).not.toContain(">10<");
  });
});
