import { decodeHtmlEntities, escapeAttr } from "./renderer/escape";
import { clickSignature } from "./tracking-token";

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

function shouldTrack(url: string, skipUrls: Set<string>): boolean {
  return !(
    !url ||
    url.startsWith("#") ||
    /^(?:mailto|tel):/i.test(url) ||
    // Already tracked: the current format and the one before it.
    url.includes("/api/t/c/") ||
    url.includes("/api/track/click/") ||
    // An unresolved merge tag: the real destination is unknown here.
    url.includes("{{") ||
    skipUrls.has(url) ||
    isUnsubscribeUrl(url)
  );
}

function skipSet(options?: TrackingOptions): Set<string> {
  return new Set(
    (options?.skipUrls ?? []).filter(Boolean).map((url) => url.trim()),
  );
}

/**
 * Rewrites every trackable link in the HTML.
 *
 * @param track Either a base URL, to which `url=<destination>` is appended,
 *   or a function that returns the full tracked URL for a destination.
 */
export function wrapLinksWithTracking(
  html: string,
  track: string | ((url: string) => string),
  options?: TrackingOptions,
): string {
  const skipUrls = skipSet(options);
  const build =
    typeof track === "function"
      ? track
      : (url: string) =>
          `${track}${track.includes("?") ? "&" : "?"}url=${encodeURIComponent(url)}`;

  return html.replace(LINK_HREF, (match, tagStart, attr, quote, rawUrl) => {
    // The document is already escaped at this point, so the attribute holds
    // entities. Decode before deciding and before re-encoding.
    const url = decodeHtmlEntities(String(rawUrl)).trim();
    if (!shouldTrack(url, skipUrls)) return match;

    return `${tagStart}${attr}${quote}${escapeAttr(build(url))}${quote}`;
  });
}

/** The destinations {@link wrapLinksWithTracking} would rewrite. */
export function trackableUrls(html: string, options?: TrackingOptions): string[] {
  const skipUrls = skipSet(options);
  const urls = new Set<string>();
  for (const match of html.matchAll(LINK_HREF)) {
    const url = decodeHtmlEntities(String(match[4])).trim();
    if (shouldTrack(url, skipUrls)) urls.add(url);
  }
  return [...urls];
}

export interface SignedClickTracking {
  /** The recipient's click endpoint, `trackingUrls(...).click`. */
  clickUrl: string;
  /** The sealed recipient token in that endpoint. */
  token: string;
  secret: string;
}

/**
 * Click tracking where each destination is signed together with the
 * recipient token, so the redirect cannot be pointed anywhere else.
 */
export async function trackLinks(
  html: string,
  tracking: SignedClickTracking,
  options?: TrackingOptions,
): Promise<string> {
  const signatures = new Map(
    await Promise.all(
      trackableUrls(html, options).map(
        async (url) =>
          [url, await clickSignature(tracking.token, url, tracking.secret)] as const,
      ),
    ),
  );

  return wrapLinksWithTracking(
    html,
    (url) =>
      `${tracking.clickUrl}?url=${encodeURIComponent(url)}&s=${signatures.get(url)}`,
    options,
  );
}
