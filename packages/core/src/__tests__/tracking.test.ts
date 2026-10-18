import { describe, it, expect } from "vitest";
import { wrapLinksWithTracking, trackableUrls, trackLinks } from "../tracking";
import { verifyClickSignature } from "../tracking-token";
import { decodeHtmlEntities } from "../renderer/escape";

const BASE = "https://senlo.io/api/track/click/1/ann%40example.com";

describe("wrapLinksWithTracking", () => {
  it("rewrites an ordinary link", () => {
    const html = '<a href="https://example.com/x">Go</a>';
    expect(wrapLinksWithTracking(html, BASE)).toBe(
      `<a href="${BASE}?url=${encodeURIComponent("https://example.com/x")}">Go</a>`,
    );
  });

  it("replaces the href only, not the first matching substring in the tag", () => {
    const html =
      '<a title="https://example.com" href="https://example.com">Go</a>';
    const out = wrapLinksWithTracking(html, BASE);

    expect(out).toContain('title="https://example.com"');
    expect(out).toContain("url=https%3A%2F%2Fexample.com");
  });

  it("leaves the unsubscribe link alone when it is passed in", () => {
    const unsubscribeUrl = "https://senlo.io/unsubscribe/token123";
    const html = `<a href="${unsubscribeUrl}">Unsubscribe</a>`;

    expect(
      wrapLinksWithTracking(html, BASE, { skipUrls: [unsubscribeUrl] }),
    ).toBe(html);
  });

  it("leaves any unsubscribe path alone even without an explicit skip", () => {
    const html = '<a href="https://senlo.io/unsubscribe/token123">Bye</a>';
    expect(wrapLinksWithTracking(html, BASE)).toBe(html);
  });

  it("leaves anchors, mailto and tel alone", () => {
    const html =
      '<a href="#top">a</a><a href="mailto:hi@senlo.io">b</a><a href="tel:+123">c</a>';
    expect(wrapLinksWithTracking(html, BASE)).toBe(html);
  });

  it("leaves an empty href alone instead of writing the URL into it", () => {
    const html = '<a href="">nothing</a>';
    expect(wrapLinksWithTracking(html, BASE)).toBe(html);
  });

  it("does not wrap an already tracked link twice", () => {
    const html = `<a href="${BASE}?url=https%3A%2F%2Fexample.com">Go</a>`;
    expect(wrapLinksWithTracking(html, BASE)).toBe(html);
  });

  it("leaves an unresolved merge tag alone", () => {
    const html = '<a href="{{contact.profile_url}}">Profile</a>';
    expect(wrapLinksWithTracking(html, BASE)).toBe(html);
  });

  it("decodes entities before encoding the destination", () => {
    const html = '<a href="https://example.com/x?a=1&amp;b=2">Go</a>';
    const out = wrapLinksWithTracking(html, BASE);

    expect(out).toContain(encodeURIComponent("https://example.com/x?a=1&b=2"));
  });

  it("appends the url parameter when the base already carries a query", () => {
    const base = `${BASE}?ref=abc`;
    const out = wrapLinksWithTracking('<a href="https://example.com">x</a>', base);

    expect(out).toContain("?ref=abc&amp;url=");
  });

  it("does not mistake data-href for the real href", () => {
    const html = '<a data-href="/internal" href="https://example.com">Go</a>';
    const out = wrapLinksWithTracking(html, BASE);

    expect(out).toContain('data-href="/internal"');
    expect(out).toContain("url=https%3A%2F%2Fexample.com");
  });

  it("still tracks a page that merely mentions unsubscribing", () => {
    const html = '<a href="https://senlo.io/blog/unsubscribe-guide">Guide</a>';
    expect(wrapLinksWithTracking(html, BASE)).toContain("/api/track/click/");
  });

  it("keeps other attributes and the link text intact", () => {
    const html =
      '<a class="btn" href="https://example.com" target="_blank" style="color:#fff">Go</a>';
    const out = wrapLinksWithTracking(html, BASE);

    expect(out).toContain('class="btn"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain(">Go</a>");
  });
});

describe("trackableUrls", () => {
  it("lists each destination once and skips what is never tracked", () => {
    const html =
      '<a href="https://a.com">1</a><a href="https://a.com">2</a>' +
      '<a href="mailto:x@y.z">3</a><a href="https://senlo.io/unsubscribe/t">4</a>' +
      '<a href="https://b.com/?x=1&amp;y=2">5</a>';
    expect(trackableUrls(html)).toEqual(["https://a.com", "https://b.com/?x=1&y=2"]);
  });
});

describe("trackLinks", () => {
  const tracking = { clickUrl: "https://senlo.io/api/t/c/TOK", token: "TOK", secret: "s" };

  it("signs each destination with the recipient token", async () => {
    const out = await trackLinks('<a href="https://a.com/x?y=1&amp;z=2">Go</a>', tracking);
    const href = decodeHtmlEntities(out.match(/href="([^"]+)"/)![1]);
    const url = new URL(href);

    expect(url.origin + url.pathname).toBe("https://senlo.io/api/t/c/TOK");
    expect(url.searchParams.get("url")).toBe("https://a.com/x?y=1&z=2");
    expect(
      await verifyClickSignature("TOK", "https://a.com/x?y=1&z=2", url.searchParams.get("s")!, "s"),
    ).toBe(true);
  });

  it("gives a swapped destination a signature that does not verify", async () => {
    const out = await trackLinks('<a href="https://a.com">Go</a>', tracking);
    const signature = new URL(decodeHtmlEntities(out.match(/href="([^"]+)"/)![1])).searchParams.get("s")!;

    expect(await verifyClickSignature("TOK", "https://evil.example", signature, "s")).toBe(false);
    expect(await verifyClickSignature("OTHER", "https://a.com", signature, "s")).toBe(false);
  });

  it("does not track a link already pointing at the click endpoint", async () => {
    const html = '<a href="https://senlo.io/api/t/c/TOK?url=x&amp;s=y">Go</a>';
    expect(await trackLinks(html, tracking)).toBe(html);
  });
});
