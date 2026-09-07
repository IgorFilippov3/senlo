import { describe, it, expect } from "vitest";
import {
  htmlToPlainText,
  stripTags,
  injectBeforeBodyEnd,
} from "../htmlToText";

describe("stripTags", () => {
  it("keeps the visible words only", () => {
    expect(stripTags("Buy <strong>now</strong>")).toBe("Buy now");
    expect(stripTags("A &amp; B")).toBe("A & B");
  });
});

describe("htmlToPlainText", () => {
  it("keeps a link destination next to its label", () => {
    expect(
      htmlToPlainText('<p>See <a href="https://senlo.io/x">the docs</a></p>'),
    ).toBe("See the docs (https://senlo.io/x)");
  });

  it("does not repeat a URL that is its own label", () => {
    expect(
      htmlToPlainText('<a href="https://senlo.io">https://senlo.io</a>'),
    ).toBe("https://senlo.io");
  });

  it("drops style and script content", () => {
    expect(
      htmlToPlainText("<style>p { color: red }</style><p>Hello</p>"),
    ).toBe("Hello");
  });

  it("drops the tracking pixel and keeps meaningful alt text", () => {
    const html =
      '<img src="https://senlo.io/api/track/open/1/a%40b.com" width="1" height="1" alt="" />' +
      '<img src="/logo.png" alt="Senlo" />';

    expect(htmlToPlainText(html)).toBe("[Senlo]");
  });

  it("turns list items into dashes and breaks into newlines", () => {
    expect(
      htmlToPlainText("<ul><li>One</li><li>Two</li></ul><p>a<br />b</p>"),
    ).toBe("- One\n- Two\n\na\nb");
  });

  it("decodes entities", () => {
    expect(htmlToPlainText("<p>Smith &amp; Sons &#39;24</p>")).toBe(
      "Smith & Sons '24",
    );
  });

  it("collapses runs of blank lines", () => {
    expect(htmlToPlainText("<div></div><div></div><p>One</p>")).toBe("One");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToPlainText("")).toBe("");
  });
});

describe("htmlToPlainText on a rendered message", () => {
  it("leaves the hidden preheader out of the text version", () => {
    const html =
      '<body><div data-senlo-preheader="true" style="display: none">Your order shipped&#847;&zwnj;&nbsp;</div><p>Hello</p></body>';

    expect(htmlToPlainText(html)).toBe("Hello");
  });

  it("does not repeat a button label from its Outlook fallback", () => {
    const html =
      "<!--[if mso]><v:roundrect><center>Track it</center></v:roundrect><![endif]-->" +
      '<!--[if !mso]><!--><a href="https://senlo.io/t">Track it</a><!--<![endif]-->';

    expect(htmlToPlainText(html)).toBe("Track it (https://senlo.io/t)");
  });
});

describe("injectBeforeBodyEnd", () => {
  it("puts the snippet inside the body", () => {
    const html = "<html><body><p>Hi</p></body></html>";
    expect(injectBeforeBodyEnd(html, "<img />")).toBe(
      "<html><body><p>Hi</p><img /></body></html>",
    );
  });

  it("falls back to appending when there is no body tag", () => {
    expect(injectBeforeBodyEnd("<p>Hi</p>", "<img />")).toBe("<p>Hi</p><img />");
  });

  it("leaves the document alone when there is nothing to inject", () => {
    const html = "<html><body></body></html>";
    expect(injectBeforeBodyEnd(html, "")).toBe(html);
  });
});
