import { describe, it, expect } from "vitest";
import {
  BLOCK_REGISTRY,
  CONTENT_BLOCK_TYPES,
  createBlockData,
  describeBlock,
  getBlockDefinition,
  contentBlockSchema,
} from "../registry";

describe("block registry", () => {
  it("covers every block type the document union declares", () => {
    expect(CONTENT_BLOCK_TYPES).toEqual([
      "heading",
      "paragraph",
      "image",
      "button",
      "spacer",
      "list",
      "divider",
      "product-line",
      "socials",
    ]);
  });

  it("gives every type a label, defaults, a schema and both renderers", () => {
    for (const type of CONTENT_BLOCK_TYPES) {
      const definition = BLOCK_REGISTRY[type];

      expect(definition.type, type).toBe(type);
      expect(definition.label, type).toBeTruthy();
      expect(typeof definition.createDefaults, type).toBe("function");
      expect(typeof definition.renderHTML, type).toBe("function");
      expect(typeof definition.renderMJML, type).toBe("function");
      expect(definition.dataSchema, type).toBeDefined();
    }
  });

  it("describes every type, including socials", () => {
    // socials was missing from the canvas label switch entirely and fell
    // through to "Block: socials"; a registry cannot lose a case silently.
    for (const type of CONTENT_BLOCK_TYPES) {
      const block = { id: "b1", type, data: createBlockData(type) };
      const described = describeBlock(block as any);

      expect(described, type).toBeTruthy();
      expect(described, type).not.toContain("Block: ");
    }
  });

  it("hands out fresh defaults, never a shared object", () => {
    const first = createBlockData("list");
    const second = createBlockData("list");

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.items).not.toBe(second.items);

    first.items.push("mutated");
    expect(second.items).toHaveLength(3);
  });

  it("accepts its own defaults as a valid document block", () => {
    for (const type of CONTENT_BLOCK_TYPES) {
      const result = contentBlockSchema.safeParse({
        id: "b1",
        type,
        data: createBlockData(type),
      });

      expect(result.success, type).toBe(true);
    }
  });

  it("returns nothing for an unknown type", () => {
    expect(getBlockDefinition("nope" as any)).toBeUndefined();
    expect(describeBlock({ type: "nope" } as any)).toBe("Block: nope");
  });
});

describe("block schemas", () => {
  it("accepts an uploaded image path, not just an absolute URL", () => {
    // /uploads/... is exactly what the upload endpoint returns, and the
    // editor's old copy of this schema rejected it.
    expect(
      BLOCK_REGISTRY.image.dataSchema.safeParse({ src: "/uploads/logo.png" })
        .success,
    ).toBe(true);
  });

  it("accepts a merge tag as a link target", () => {
    expect(
      BLOCK_REGISTRY.button.dataSchema.safeParse({
        text: "Go",
        href: "{{contact.profile_url}}",
      }).success,
    ).toBe(true);
  });

  it("accepts mailto and rejects nonsense", () => {
    expect(
      BLOCK_REGISTRY.button.dataSchema.safeParse({
        text: "Mail",
        href: "mailto:hi@senlo.io",
      }).success,
    ).toBe(true);

    expect(
      BLOCK_REGISTRY.button.dataSchema.safeParse({
        text: "Bad",
        href: "not a url",
      }).success,
    ).toBe(false);
  });

  it("accepts every heading level the renderer supports", () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(
        BLOCK_REGISTRY.heading.dataSchema.safeParse({ text: "Hi", level })
          .success,
        `level ${level}`,
      ).toBe(true);
    }
  });

  it("requires the content a block cannot render without", () => {
    expect(
      BLOCK_REGISTRY.heading.dataSchema.safeParse({ text: "" }).success,
    ).toBe(false);
    expect(
      BLOCK_REGISTRY.list.dataSchema.safeParse({ items: [] }).success,
    ).toBe(false);
    expect(
      BLOCK_REGISTRY.socials.dataSchema.safeParse({ links: [] }).success,
    ).toBe(false);
  });
});

describe("rendering from a definition", () => {
  // The editor canvas calls renderHTML directly, with a context it builds by
  // hand, so a definition that only works through renderEmailDesign is not
  // good enough.
  const bareContext = { responsiveStyles: [] } as any;

  it("renders every type from its own defaults, with no options", () => {
    for (const type of CONTENT_BLOCK_TYPES) {
      const block = { id: "b1", type, data: createBlockData(type) };
      const html = BLOCK_REGISTRY[type].renderHTML(block, bareContext);

      expect(html, type).toBeTruthy();
      expect(html.trim().startsWith("<"), type).toBe(true);
    }
  });

  it("renders every type to MJML from its own defaults", () => {
    for (const type of CONTENT_BLOCK_TYPES) {
      const block = { id: "b1", type, data: createBlockData(type) };
      const mjml = BLOCK_REGISTRY[type].renderMJML(block, undefined);

      expect(mjml, type).toBeTruthy();
      expect(mjml.includes("<mj-"), type).toBe(true);
    }
  });

  it("survives a block whose optional fields are all missing", () => {
    for (const type of CONTENT_BLOCK_TYPES) {
      const minimal: Record<string, any> = {
        heading: { text: "Hi" },
        paragraph: { text: "Hi" },
        image: { src: "" },
        button: { text: "Go", href: "" },
        spacer: { height: 0 },
        list: { items: ["One"] },
        divider: {},
        "product-line": { leftText: "A", rightText: "B" },
        socials: { links: [{ type: "github", url: "", icon: "" }] },
      };

      const block = { id: "b1", type, data: minimal[type] };
      expect(
        () => BLOCK_REGISTRY[type].renderHTML(block, bareContext),
        type,
      ).not.toThrow();
    }
  });
});
