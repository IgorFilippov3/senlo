import { escapeAttr } from "./escape";

/**
 * An opening `<a>` tag. The lookahead is what keeps `<abbr>`, `<address>` and
 * `<area>` out of it.
 */
const ANCHOR_OPEN = /<a(?=[\s>])[^>]*>/gi;

/** The tag's own `style`, with whichever quote character it was written with. */
const STYLE_ATTR = /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i;

/**
 * A `color` declaration, and not `background-color` or `border-color`: those
 * only ever appear after a `-`, which neither branch here allows.
 */
const COLOR_DECLARATION = /(?:^|;)\s*color\s*:/i;

/**
 * Gives every link the author wrote inside a block's text the colour of that
 * text.
 *
 * The text fields hold raw HTML on purpose - an author can type
 * `<a href="...">terms</a>` in the middle of a paragraph - and a bare anchor
 * is styled by the mail client, which means the reader gets whatever blue that
 * client likes rather than the colour the block is set to. The colour has to
 * be written onto the anchor itself: `inherit` is not reliably honoured on a
 * link, and clients apply their own colour before any inheritance.
 *
 * The underline is left alone. A link the same colour as the text around it
 * and with nothing else to mark it is a link nobody clicks.
 *
 * An anchor whose author gave it a colour of its own is returned untouched -
 * that is a decision already made, and this is only here to supply one where
 * none exists.
 */
export function colorInlineLinks(html: unknown, color?: string): string {
  const source = html === undefined || html === null ? "" : String(html);

  // `inherit` is what a block falls back to when neither it nor the document
  // names a colour. Writing it onto the anchor would be the unreliable half of
  // the problem rather than the fix, so such a block is left as it was.
  if (!source || !color || color === "inherit") return source;
  if (!/<a[\s>]/i.test(source)) return source;

  const declaration = `color: ${escapeAttr(color)}`;

  return source.replace(ANCHOR_OPEN, (tag) => {
    const style = tag.match(STYLE_ATTR);

    if (!style) return tag.replace(/^<a/i, `<a style="${declaration}"`);
    if (COLOR_DECLARATION.test(style[2])) return tag;

    const quote = style[1];
    const existing = style[2].trim().replace(/;\s*$/, "");
    const merged = existing ? `${existing}; ${declaration}` : declaration;

    return tag.replace(STYLE_ATTR, ` style=${quote}${merged}${quote}`);
  });
}

export function renderPadding(padding?: any): string {
  if (!padding) return "0px 0px 0px 0px";
  return `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px`;
}

export function normalizeUrl(url: string, baseUrl?: string): string {
  if (!url || !baseUrl) return url || "";
  if (url.startsWith("/") && baseUrl) {
    // Remove trailing slash from baseUrl if present
    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}${url}`;
  }
  return url;
}

/**
 * The CSS declarations for a border, in the shape the blocks store it: either
 * one `width` for every side, or per-side widths.
 */
export function borderDeclarations(border?: any): string[] {
  if (!border) return [];

  const style = border.style || "solid";
  const color = border.color || "#000000";
  const declarations: string[] = [];

  if (border.width !== undefined && border.width > 0) {
    declarations.push(`border: ${border.width}px ${style} ${color}`);
    return declarations;
  }

  if (border.top)
    declarations.push(`border-top: ${border.top}px ${style} ${color}`);
  if (border.right)
    declarations.push(`border-right: ${border.right}px ${style} ${color}`);
  if (border.bottom)
    declarations.push(`border-bottom: ${border.bottom}px ${style} ${color}`);
  if (border.left)
    declarations.push(`border-left: ${border.left}px ${style} ${color}`);

  return declarations;
}

/** Whether a block carries any of the card styling from `boxFields`. */
export function hasBoxStyles(data?: any): boolean {
  return (
    Boolean(data?.backgroundColor) ||
    borderDeclarations(data?.border).length > 0 ||
    Number(data?.borderRadius) > 0
  );
}

/** Whether a `margin` carries a gap on any side. */
export function hasMargin(margin?: any): boolean {
  return Boolean(
    margin && (margin.top || margin.right || margin.bottom || margin.left),
  );
}

/** One table cell, which is the only element every client - Outlook included - backgrounds, borders and pads correctly. */
export function cell(style: string, inner: string): string {
  return `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 0;">
      <tr>
        <td style="${escapeAttr(style)}">${inner}</td>
      </tr>
    </table>
  `;
}

/**
 * Wraps a block's markup in its background, border and outer gap.
 *
 * A block whose author set none of them comes back untouched, so every message
 * built before these fields existed renders byte for byte as it did. The
 * background and the gap need a cell each: a single cell cannot both paint a
 * background and keep it out of the space between two cards.
 *
 * The block's own `padding` stays where it always was - on its own element,
 * inside the background - so it reads as the card's inner padding.
 */
export function renderBox(html: string, data?: any): string {
  const card = hasBoxStyles(data);
  const margin = hasMargin(data?.margin);

  if (!card && !margin) return html;

  let out = html;

  if (card) {
    const styles: string[] = [];
    if (data.backgroundColor)
      styles.push(`background-color: ${data.backgroundColor}`);
    styles.push(...borderDeclarations(data.border));
    if (Number(data.borderRadius) > 0)
      styles.push(`border-radius: ${Number(data.borderRadius)}px`);

    out = cell(styles.join("; "), out);
  }

  if (margin) {
    out = cell(`padding: ${renderPadding(data.margin)}`, out);
  }

  return out;
}

/**
 * The MJML half of the same thing. MJML has no border on `mj-text`, so a
 * styled block becomes a table inside it and the component's own `padding`
 * carries the outer gap. With no card to draw, a gap and a padding are the same
 * space, so they are simply added together.
 */
export function renderMJMLBox(
  content: string,
  data?: any,
): { padding: string; content: string } {
  if (!hasBoxStyles(data)) {
    return { padding: renderPadding(addPadding(data?.margin, data?.padding)), content };
  }

  const styles: string[] = [`padding: ${renderPadding(data.padding)}`];
  if (data.backgroundColor)
    styles.push(`background-color: ${data.backgroundColor}`);
  styles.push(...borderDeclarations(data.border));
  if (Number(data.borderRadius) > 0)
    styles.push(`border-radius: ${Number(data.borderRadius)}px`);

  return {
    padding: renderPadding(data.margin),
    content: `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 0;">
            <tr>
              <td style="${escapeAttr(styles.join("; "))}">${content}</td>
            </tr>
          </table>`,
  };
}

function addPadding(a?: any, b?: any) {
  if (!a) return b;
  if (!b) return a;
  return {
    top: (a.top || 0) + (b.top || 0),
    right: (a.right || 0) + (b.right || 0),
    bottom: (a.bottom || 0) + (b.bottom || 0),
    left: (a.left || 0) + (b.left || 0),
  };
}
