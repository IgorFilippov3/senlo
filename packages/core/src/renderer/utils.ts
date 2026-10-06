import { escapeAttr } from "./escape";
import { ZERO_CORNER_RADIUS } from "../blocks/shared";
import type { CornerRadius } from "../blocks/shared";

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

/**
 * The four corners of a radius, whichever of its two shapes it was stored in.
 *
 * A number means every corner, which is how the radius was stored before the
 * corners existed and is still what a document handed straight to the renderer
 * can carry: `migrateEmailDesign` only reshapes a document whose version is
 * behind, so a caller that stamps the current version on a payload of its own -
 * the AI endpoint and the public API both can - gets here unreshaped. Reading
 * the raw field anywhere else is how that case turns into `NaN`.
 */
export function resolveCornerRadius(
  value?: number | CornerRadius,
): Required<CornerRadius> {
  if (typeof value === "number") {
    const all = Number.isFinite(value) && value > 0 ? value : 0;
    return { topLeft: all, topRight: all, bottomRight: all, bottomLeft: all };
  }

  if (!value || typeof value !== "object") return { ...ZERO_CORNER_RADIUS };

  return {
    topLeft: Number(value.topLeft) || 0,
    topRight: Number(value.topRight) || 0,
    bottomRight: Number(value.bottomRight) || 0,
    bottomLeft: Number(value.bottomLeft) || 0,
  };
}

/**
 * The corners as CSS writes them: one value when they are all the same - which
 * includes all zero, and is what keeps the output of every document written
 * before this feature byte for byte what it was - and otherwise the four-value
 * form, clockwise from the top left.
 */
export function formatCornerRadius(corners: Required<CornerRadius>): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;

  if (
    topLeft === topRight &&
    topRight === bottomRight &&
    bottomRight === bottomLeft
  ) {
    return `${topLeft}px`;
  }

  return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
}

/** Whether a radius, in either shape, rounds anything at all. */
export function hasCornerRadius(value?: number | CornerRadius): boolean {
  const { topLeft, topRight, bottomRight, bottomLeft } =
    resolveCornerRadius(value);
  return topLeft > 0 || topRight > 0 || bottomRight > 0 || bottomLeft > 0;
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
    hasCornerRadius(data?.borderRadius)
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
    if (hasCornerRadius(data.borderRadius))
      styles.push(
        `border-radius: ${formatCornerRadius(resolveCornerRadius(data.borderRadius))}`,
      );

    out = cell(styles.join("; "), out);
  }

  if (margin) {
    out = cell(`padding: ${renderPadding(data.margin)}`, out);
  }

  return out;
}

/**
 * Wraps a column's blocks in the card the column draws, and the gap around it.
 *
 * `renderBox` one level up, with one difference: a block keeps its inner space
 * on its own element, while a column has no element of its own besides this
 * cell, so its padding is written here, inside the background. With no card to
 * draw, padding and margin are the same space and land on one cell.
 *
 * A column with none of it set comes back untouched, so a message built before
 * columns could be styled renders byte for byte as it did.
 */
export function renderColumnBox(html: string, settings?: any): string {
  const card = hasBoxStyles(settings);
  const padding = hasMargin(settings?.padding);
  const margin = hasMargin(settings?.margin);

  if (!card && !padding && !margin) return html;

  let out = html;

  if (card) {
    const styles: string[] = [];
    if (settings.backgroundColor)
      styles.push(`background-color: ${settings.backgroundColor}`);
    styles.push(...borderDeclarations(settings.border));
    if (hasCornerRadius(settings.borderRadius))
      styles.push(
        `border-radius: ${formatCornerRadius(resolveCornerRadius(settings.borderRadius))}`,
      );
    if (padding) styles.push(`padding: ${renderPadding(settings.padding)}`);

    out = cell(styles.join("; "), out);

    if (margin) out = cell(`padding: ${renderPadding(settings.margin)}`, out);
    return out;
  }

  return cell(
    `padding: ${renderPadding(addPadding(settings?.margin, settings?.padding))}`,
    out,
  );
}

/**
 * The column's card as `mj-column` attributes.
 *
 * `mj-column` draws a card two ways: `background-color` / `border` /
 * `border-radius` on the column itself, inside which `padding` is the space
 * around the content; or `inner-*` attributes, outside which `padding` is the
 * gap. It has no attribute for both spaces at once, so a column with a margin
 * takes the `inner-*` form and its inner padding is dropped from the export.
 * The HTML path, which is what is sent, keeps both.
 */
export function mjmlColumnAttributes(settings?: any): string {
  const card = hasBoxStyles(settings);
  const margin = hasMargin(settings?.margin);
  const padding = hasMargin(settings?.padding);

  if (!card) {
    if (!margin && !padding) return "";
    return ` padding="${renderPadding(addPadding(settings?.margin, settings?.padding))}"`;
  }

  const prefix = margin ? "inner-" : "";
  const attrs: string[] = [];

  if (settings.backgroundColor)
    attrs.push(`${prefix}background-color="${escapeAttr(settings.backgroundColor)}"`);

  for (const declaration of borderDeclarations(settings.border)) {
    const [name, value] = declaration.split(/:\s*/, 2);
    attrs.push(`${prefix}${name}="${escapeAttr(value)}"`);
  }

  if (hasCornerRadius(settings.borderRadius))
    attrs.push(
      `${prefix}border-radius="${escapeAttr(formatCornerRadius(resolveCornerRadius(settings.borderRadius)))}"`,
    );

  if (margin) attrs.push(`padding="${renderPadding(settings.margin)}"`);
  else if (padding) attrs.push(`padding="${renderPadding(settings.padding)}"`);

  return attrs.length ? " " + attrs.join(" ") : "";
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
  if (hasCornerRadius(data.borderRadius))
    styles.push(
      `border-radius: ${formatCornerRadius(resolveCornerRadius(data.borderRadius))}`,
    );

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
