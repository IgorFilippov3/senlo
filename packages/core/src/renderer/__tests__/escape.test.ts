import { describe, it, expect } from "vitest";
import {
  escapeAttr,
  escapeMergeValue,
  escapeCssValue,
  decodeHtmlEntities,
  isDangerousUrl,
  sanitizeUrl,
  sanitizeUrlsInHtml,
} from "../escape";

describe("escapeAttr", () => {
  it("escapes the characters that break out of text and attributes", () => {
    expect(escapeAttr('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(escapeAttr("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeAttr("it's")).toBe("it&#39;s");
  });

  it("keeps merge tag braces so tags in attributes still resolve", () => {
    expect(escapeAttr("{{contact.first_name}}")).toBe("{{contact.first_name}}");
  });

  it("renders null and undefined as an empty string", () => {
    expect(escapeAttr(null)).toBe("");
    expect(escapeAttr(undefined)).toBe("");
  });
});

describe("escapeMergeValue", () => {
  it("escapes markup like escapeAttr does", () => {
    expect(escapeMergeValue("</td><h1>hi</h1>")).toBe(
      "&lt;/td&gt;&lt;h1&gt;hi&lt;/h1&gt;",
    );
  });

  it("escapes the opening brace so a value cannot become a merge tag", () => {
    expect(escapeMergeValue("{{contact.email}}")).toBe(
      "&#123;&#123;contact.email}}",
    );
  });

  it("escapes semicolons so a value cannot append CSS declarations", () => {
    expect(escapeMergeValue("red; position: fixed")).toBe(
      "red&#59; position: fixed",
    );
  });

  it("does not escape the entities it just produced", () => {
    expect(escapeMergeValue("a & b")).toBe("a &amp; b");
  });
});

describe("escapeAttr keeps style attributes usable", () => {
  it("leaves declaration separators alone", () => {
    expect(escapeAttr("color: red; padding: 0")).toBe("color: red; padding: 0");
  });
});

describe("escapeCssValue", () => {
  it("strips characters that would close a style block", () => {
    expect(escapeCssValue("Arial</style><script>alert(1)</script>")).toBe(
      "Arialstylescriptalert1script",
    );
  });

  it("keeps quoted font family names usable", () => {
    expect(escapeCssValue('"Helvetica Neue", Arial, sans-serif')).toBe(
      '"Helvetica Neue", Arial, sans-serif',
    );
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeHtmlEntities("a&amp;b")).toBe("a&b");
    expect(decodeHtmlEntities("java&#115;cript:")).toBe("javascript:");
    expect(decodeHtmlEntities("java&#x73;cript:")).toBe("javascript:");
  });
});

describe("isDangerousUrl", () => {
  it("rejects executable schemes", () => {
    expect(isDangerousUrl("javascript:alert(1)")).toBe(true);
    expect(isDangerousUrl("JaVaScRiPt:alert(1)")).toBe(true);
    expect(isDangerousUrl("vbscript:msgbox")).toBe(true);
    expect(isDangerousUrl("file:///etc/passwd")).toBe(true);
  });

  it("sees through entity encoding and control characters", () => {
    expect(isDangerousUrl("java&#115;cript:alert(1)")).toBe(true);
    expect(isDangerousUrl("java\tscript:alert(1)")).toBe(true);
    expect(isDangerousUrl("  javascript:alert(1)")).toBe(true);
  });

  it("accepts the schemes an email actually uses", () => {
    expect(isDangerousUrl("https://senlo.io")).toBe(false);
    expect(isDangerousUrl("http://senlo.io")).toBe(false);
    expect(isDangerousUrl("mailto:hi@senlo.io")).toBe(false);
    expect(isDangerousUrl("/uploads/logo.png")).toBe(false);
    expect(isDangerousUrl("#")).toBe(false);
  });

  it("allows data:image only where images are allowed", () => {
    expect(isDangerousUrl("data:image/png;base64,AAA", true)).toBe(false);
    expect(isDangerousUrl("data:image/png;base64,AAA", false)).toBe(true);
    expect(isDangerousUrl("data:text/html,<script>", true)).toBe(true);
  });
});

describe("sanitizeUrl", () => {
  it("replaces a dangerous URL with the fallback", () => {
    expect(sanitizeUrl("javascript:alert(1)", { fallback: "#" })).toBe("#");
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });

  it("passes safe URLs and merge tags through untouched", () => {
    expect(sanitizeUrl("https://senlo.io/x?a=1&b=2")).toBe(
      "https://senlo.io/x?a=1&b=2",
    );
    expect(sanitizeUrl("{{contact.profile_url}}")).toBe(
      "{{contact.profile_url}}",
    );
  });
});

describe("sanitizeUrlsInHtml", () => {
  it("neutralizes a dangerous href that arrived through a merge tag", () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    expect(sanitizeUrlsInHtml(html)).toBe('<a href="#">click</a>');
  });

  it("empties a dangerous src", () => {
    const html = '<img src="data:text/html,<script>" alt="" />';
    expect(sanitizeUrlsInHtml(html)).toContain('src=""');
  });

  it("keeps inline images and ordinary links", () => {
    const html =
      '<a href="https://senlo.io">x</a><img src="data:image/png;base64,AAA" />';
    expect(sanitizeUrlsInHtml(html)).toBe(html);
  });

  it("handles single quoted attributes", () => {
    expect(sanitizeUrlsInHtml("<a href='javascript:x'>x</a>")).toBe(
      "<a href='#'>x</a>",
    );
  });
});
