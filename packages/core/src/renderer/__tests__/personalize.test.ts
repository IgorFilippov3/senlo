import { describe, it, expect } from "vitest";
import type { EmailDesignDocument, RowBlock } from "../../emailDesign";
import { personalizeEmail, isRecipientIndependent } from "../personalize";
import { renderEmailDesign } from "../renderEmailDesign";

const TRACK = {
  clickUrl: "https://senlo.io/api/t/c/TOKEN",
  token: "TOKEN",
  secret: "test-secret",
};
const PIXEL = "https://senlo.io/api/t/o/TOKEN";

function doc(rows: RowBlock[]): EmailDesignDocument {
  return { version: 1, rows, settings: { contentWidth: 600 } };
}

function row(blocks: RowBlock["columns"][number]["blocks"]): RowBlock {
  return {
    id: "row-1",
    type: "row",
    columns: [{ id: "col-1", width: 100, blocks }],
    settings: {},
  };
}

describe("personalizeEmail", () => {
  it("substitutes merge tags", async () => {
    const html = await personalizeEmail("<p>Hi {{contact.first_name}}</p>", {
      data: { contact: { first_name: "Ann" } },
    });

    expect(html).toBe("<p>Hi Ann</p>");
  });

  it("escapes what it substitutes", async () => {
    const html = await personalizeEmail("<p>{{contact.first_name}}</p>", {
      data: { contact: { first_name: "<script>alert(1)</script>" } },
    });

    expect(html).not.toContain("<script>");
  });

  it("checks URL schemes after substitution, not before", async () => {
    // This is the reason the scheme check cannot stay inside the render: at
    // render time the href is still a merge tag.
    const html = await personalizeEmail('<a href="{{contact.url}}">x</a>', {
      data: { contact: { url: "javascript:alert(1)" } },
    });

    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("wraps links for click tracking after they resolve", async () => {
    const html = await personalizeEmail('<a href="{{contact.url}}">x</a>', {
      data: { contact: { url: "https://example.com/x" } },
      clickTracking: TRACK,
    });

    expect(html).toContain(
      "https://senlo.io/api/t/c/TOKEN?url=https%3A%2F%2Fexample.com%2Fx&amp;s=",
    );
  });

  it("leaves the unsubscribe link out of click tracking", async () => {
    const unsubscribe = "https://senlo.io/unsubscribe/abc";
    const html = await personalizeEmail(`<a href="${unsubscribe}">Bye</a>`, {
      data: {},
      clickTracking: TRACK,
      skipTrackingUrls: [unsubscribe],
    });

    expect(html).toBe(`<a href="${unsubscribe}">Bye</a>`);
  });

  it("puts the tracking pixel inside the body", async () => {
    const html = await personalizeEmail("<html><body><p>Hi</p></body></html>", {
      trackingPixelUrl: PIXEL,
    });

    expect(html).toContain(`<img src="${PIXEL}"`);
    expect(html.indexOf(PIXEL)).toBeLessThan(html.indexOf("</body>"));
  });

  it("changes nothing when given nothing to do", async () => {
    expect(await personalizeEmail("<p>Hi</p>")).toBe("<p>Hi</p>");
  });
});

describe("render once, personalize many", () => {
  const design = doc([
    row([
      { id: "b1", type: "paragraph", data: { text: "Hi {{contact.name}}" } },
    ]),
  ]);

  it("produces the same message as rendering per recipient did", async () => {
    const perRecipient = renderEmailDesign(design, {
      baseUrl: "https://senlo.io",
      data: { contact: { name: "Ann" } },
    });

    const template = renderEmailDesign(design, { baseUrl: "https://senlo.io" });
    const personalized = await personalizeEmail(template, {
      data: { contact: { name: "Ann" } },
    });

    expect(personalized).toBe(perRecipient);
  });

  it("gives each recipient their own values from one render", async () => {
    const template = renderEmailDesign(design, { baseUrl: "https://senlo.io" });

    expect(await personalizeEmail(template, { data: { contact: { name: "Ann" } } }))
      .toContain("Hi Ann");
    expect(await personalizeEmail(template, { data: { contact: { name: "Bo" } } }))
      .toContain("Hi Bo");
  });
});

describe("isRecipientIndependent", () => {
  it("is true for a document that looks the same for everyone", async () => {
    expect(
      isRecipientIndependent(
        doc([row([{ id: "b1", type: "paragraph", data: { text: "Hi" } }])]),
      ),
    ).toBe(true);
  });

  it("is false when a block has a condition", async () => {
    expect(
      isRecipientIndependent(
        doc([
          row([
            {
              id: "b1",
              type: "paragraph",
              data: { text: "VIP" },
              condition: {
                variable: "contact.plan",
                operator: "equals",
                value: "pro",
              },
            },
          ]),
        ]),
      ),
    ).toBe(false);
  });

  it("is false when a row has a condition or a loop", async () => {
    const conditional = row([
      { id: "b1", type: "paragraph", data: { text: "Hi" } },
    ]);
    conditional.condition = {
      variable: "contact.plan",
      operator: "is_set",
    };
    expect(isRecipientIndependent(doc([conditional]))).toBe(false);

    const looped = row([{ id: "b1", type: "paragraph", data: { text: "Hi" } }]);
    looped.loop = { variable: "custom.items", alias: "item" };
    expect(isRecipientIndependent(doc([looped]))).toBe(false);
  });

  it("is true for an empty document", async () => {
    expect(isRecipientIndependent(doc([]))).toBe(true);
  });
});
