import { decodeHtmlEntities, escapeAttr } from "./renderer/escape";

export interface TrackingOptions {
  /**
   * URLs that must keep pointing at their original destination. The unsubscribe
   * link belongs here: routing it through click tracking adds a hop to an
   * action that has to work every time, and it inflates click statistics.
   */
  skipUrls?: string[];
}

/**
 * Matches the href of an <a> tag, capturing the part before the value, the
 * quote character and the value itself. Rewriting through these groups replaces
 * the attribute value exactly, instead of the first occurrence of the URL
 * anywhere in the tag.
 *
 * The mandatory whitespace before `href` is what keeps `data-href` and other
 * attributes ending in "href" from being matched instead of the real one.
 */
const LINK_HREF = /(<a(?=[\s>])[^>]*?\s)(href\s*=\s*)(["'])(.*?)\3/gi;

/** Matches the /unsubscribe path segment, not merely the word. */
const UNSUBSCRIBE_PATH = /\/unsubscribe(?:\/|$)/;

function isUnsubscribeUrl(url: string): boolean {
  try {
    const path = url.startsWith("http")
      ? new URL(url).pathname
      : url.split("?")[0];
    return UNSUBSCRIBE_PATH.test(path);
  } catch {
    return UNSUBSCRIBE_PATH.test(url);
  }
}

/**
 * Wraps links in the HTML with a click tracking URL.
 *
 * @param html Original HTML content
 * @param trackingBaseUrl The base URL for click tracking
 *   (e.g. https://senlo.io/api/track/click/123/user@example.com)
 * @param options Additional URLs to leave untouched
 * @returns HTML with rewritten links
 */
export function wrapLinksWithTracking(
  html: string,
  trackingBaseUrl: string,
  options?: TrackingOptions,
): string {
  const skipUrls = new Set(
    (options?.skipUrls ?? []).filter(Boolean).map((url) => url.trim()),
  );

  return html.replace(LINK_HREF, (match, tagStart, attr, quote, rawUrl) => {
    // The document is already escaped at this point, so the attribute holds
    // entities. Decode before deciding and before re-encoding.
    const url = decodeHtmlEntities(String(rawUrl)).trim();

    if (
      !url ||
      url.startsWith("#") ||
      /^(?:mailto|tel):/i.test(url) ||
      url.includes("/api/track/click/") ||
      // An unresolved merge tag: the real destination is unknown here.
      url.includes("{{") ||
      skipUrls.has(url) ||
      isUnsubscribeUrl(url)
    ) {
      return match;
    }

    const separator = trackingBaseUrl.includes("?") ? "&" : "?";
    const trackedUrl = `${trackingBaseUrl}${separator}url=${encodeURIComponent(url)}`;

    return `${tagStart}${attr}${quote}${escapeAttr(trackedUrl)}${quote}`;
  });
}
