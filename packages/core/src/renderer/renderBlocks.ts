import { ContentBlock } from "../emailDesign";
import { RenderContext, globalsOf } from "./types";
import { renderPadding, normalizeUrl } from "./utils";
import { escapeAttr, sanitizeUrl } from "./escape";
import { stripTags } from "./htmlToText";
import { evaluateCondition } from "./conditions";

export function renderBlock(
  block: ContentBlock,
  context: RenderContext,
): string {
  if (!evaluateCondition(block.condition, context)) {
    return "";
  }

  switch (block.type) {
    case "heading":
      return renderHeading(block, context);
    case "paragraph":
      return renderParagraph(block, context);
    case "image":
      return renderImage(block, context);
    case "button":
      return renderButton(block, context);
    case "spacer":
      return renderSpacer(block);
    case "list":
      return renderList(block, context);
    case "divider":
      return renderDivider(block);
    case "product-line":
      return renderProductLine(block, context);
    case "socials":
      return renderSocials(block, context);
    default:
      return `<!-- Unknown block type: ${String((block as any).type).replace(/[^a-z0-9_-]/gi, "")} -->`;
  }
}

function renderSocials(block: any, context: RenderContext): string {
  const { data } = block;
  const iconSize = Number(data.size) || 32;
  const spacing = Number(data.spacing) || 10;
  const padding = renderPadding(data.padding);

  const containerStyle = [
    `padding: ${padding}`,
    `text-align: ${data.align || "center"}`,
  ].join("; ");

  const linksHtml = (data.links || [])
    .map((link: any) => {
      const iconSrc = escapeAttr(
        sanitizeUrl(normalizeUrl(link.icon, context.options?.baseUrl), {
          allowDataImage: true,
        }),
      );
      const imgHtml = `<img src="${iconSrc}" alt="${escapeAttr(link.type)}" width="${iconSize}" height="${iconSize}" style="display: inline-block; border-radius: 4px;" />`;
      if (link.url) {
        return `<a href="${escapeAttr(sanitizeUrl(link.url, { fallback: "#" }))}" target="_blank" style="text-decoration: none; margin: 0 ${spacing / 2}px; display: inline-block;">${imgHtml}</a>`;
      }
      return `<span style="margin: 0 ${spacing / 2}px; display: inline-block;">${imgHtml}</span>`;
    })
    .join("");

  return `<div style="${escapeAttr(containerStyle)}">${linksHtml}</div>`;
}

function renderHeading(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);
  // The level becomes a tag name, so it can never be taken from the document
  // as-is: designJson is JSON and carries no type guarantees.
  const level = Math.min(6, Math.max(1, Math.trunc(Number(data.level)) || 2));
  const Tag = `h${level}`;

  const style = [
    `margin: 0`,
    // Outlook's Word engine ignores the `*` selector in the head, so the font
    // has to be written on the element itself or the message falls back to
    // Times New Roman.
    `font-family: ${globals.fontFamily}`,
    `text-align: ${data.align || "left"}`,
    `color: ${data.color || globals.textColor || "inherit"}`,
    `font-size: ${data.fontSize ? data.fontSize + "px" : "inherit"}`,
    `line-height: ${data.lineHeight || 1.3}`,
    `font-weight: ${data.fontWeight || "bold"}`,
    `text-transform: ${data.textTransform || "none"}`,
    `letter-spacing: ${
      data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"
    }`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  // data.text is raw HTML on purpose - the editor lets the author write markup.
  let content = data.text;
  if (data.href) {
    content = `<a href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }))}" target="_blank" style="color: inherit; text-decoration: none;">${content}</a>`;
  }

  return `<${Tag} style="${escapeAttr(style)}">${content}</${Tag}>`;
}

function renderParagraph(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);

  const style = [
    `margin: 0`,
    `font-family: ${globals.fontFamily}`,
    `text-align: ${data.align || "left"}`,
    `color: ${data.color || globals.textColor || "inherit"}`,
    `font-size: ${data.fontSize ? data.fontSize + "px" : "16px"}`,
    `line-height: ${data.lineHeight || 1.5}`,
    `font-weight: ${data.fontWeight || "normal"}`,
    `text-transform: ${data.textTransform || "none"}`,
    `letter-spacing: ${
      data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"
    }`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  let content = data.text;
  if (data.href) {
    content = `<a href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }))}" target="_blank" style="color: inherit; text-decoration: none;">${content}</a>`;
  }

  return `<p style="${escapeAttr(style)}">${content}</p>`;
}

function renderImage(block: any, context: RenderContext): string {
  const { data } = block;

  const imgStyle = [
    `display: inline-block`,
    `outline: none`,
    `text-decoration: none`,
    `-ms-interpolation-mode: bicubic`,
    `width: ${
      data.fullWidth ? "100%" : data.width ? data.width + "px" : "auto"
    }`,
    `max-width: 100%`,
    `height: auto`,
    `border-radius: ${data.borderRadius || 0}px`,
    `border: ${
      data.border?.width
        ? `${data.border.width}px ${data.border.style} ${data.border.color}`
        : "0"
    }`,
    `vertical-align: middle`,
  ].join("; ");

  const containerStyle = [
    `text-align: ${data.align || "center"}`,
    `padding: ${renderPadding(data.padding)}`,
    `font-size: 0px`, // To remove line-height gaps around inline-block image
    `line-height: 0px`,
  ].join("; ");

  const src = escapeAttr(
    sanitizeUrl(normalizeUrl(data.src, context.options?.baseUrl), {
      allowDataImage: true,
    }),
  );
  const widthAttr = Number(data.width) ? ` width="${Number(data.width)}"` : "";
  let html = `<img src="${src}" alt="${escapeAttr(data.alt || "")}"${widthAttr} style="${escapeAttr(imgStyle)}" />`;

  if (data.href) {
    html = `<a href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }))}" target="_blank" style="text-decoration: none; display: inline-block;">${html}</a>`;
  }

  return `<div style="${escapeAttr(containerStyle)}">${html}</div>`;
}

function renderButton(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);

  const rawPadding = data.padding || { top: 12, right: 24, bottom: 12, left: 24 };
  const padding = {
    top: Number(rawPadding.top) || 0,
    right: Number(rawPadding.right) || 0,
    bottom: Number(rawPadding.bottom) || 0,
    left: Number(rawPadding.left) || 0,
  };
  const border = data.border || { width: 0, style: "solid", color: "#000000" };

  const styles = [
    `background-color: ${data.backgroundColor || "#3b82f6"}`,
    `color: ${data.color || "#ffffff"}`,
    `font-family: ${globals.fontFamily}`,
    `display: ${data.fullWidth ? "block" : "inline-block"}`,
    `padding: ${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    `text-decoration: none`,
    `border-radius: ${data.borderRadius || 4}px`,
    `font-size: ${data.fontSize || 16}px`,
    `font-weight: ${data.fontWeight || "bold"}`,
    `text-transform: ${data.textTransform || "none"}`,
    `letter-spacing: ${
      data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"
    }`,
    `text-align: center`,
  ];

  // Handle borders
  if (border.width !== undefined && border.width > 0) {
    styles.push(
      `border: ${border.width}px ${border.style || "solid"} ${border.color || "#000000"}`,
    );
  } else {
    // Individual borders
    if (border.top)
      styles.push(
        `border-top: ${border.top}px ${border.style || "solid"} ${border.color || "#000000"}`,
      );
    if (border.right)
      styles.push(
        `border-right: ${border.right}px ${border.style || "solid"} ${border.color || "#000000"}`,
      );
    if (border.bottom)
      styles.push(
        `border-bottom: ${border.bottom}px ${border.style || "solid"} ${border.color || "#000000"}`,
      );
    if (border.left)
      styles.push(
        `border-left: ${border.left}px ${border.style || "solid"} ${border.color || "#000000"}`,
      );
  }

  // Handle shadow with fallback for hard shadows (blur: 0)
  if (data.shadow) {
    const { x = 0, y = 0, blur = 0, color = "#000000" } = data.shadow;

    // Add box-shadow for modern clients
    styles.push(`box-shadow: ${x}px ${y}px ${blur}px ${color}`);

    // Fallback for hard shadows (often used in Brutalism style)
    if (blur === 0 && (x !== 0 || y !== 0)) {
      if (y > 0) styles.push(`border-bottom: ${y}px solid ${color}`);
      if (x > 0) styles.push(`border-right: ${x}px solid ${color}`);
      if (y < 0) styles.push(`border-top: ${Math.abs(y)}px solid ${color}`);
      if (x < 0) styles.push(`border-left: ${Math.abs(x)}px solid ${color}`);
    }
  }

  const href = escapeAttr(sanitizeUrl(data.href, { fallback: "#" }) || "#");
  const anchor = `<a href="${href}" target="_blank" style="${escapeAttr(styles.join("; "))}">${data.text}</a>`;

  return `
    <div style="text-align: ${escapeAttr(data.align || "center")}; padding: 10px 0;">
      ${renderButtonVml(data, border, padding, href, globals.fontFamily)}
      <!--[if !mso]><!-->
      ${anchor}
      <!--<![endif]-->
    </div>
  `;
}

/**
 * Outlook 2007-2019 runs on the Word engine, which drops padding and
 * border-radius on an inline element. Without this the button degrades into a
 * coloured text link with no body. VML draws the shape instead, so the
 * dimensions have to be given explicitly - Word will not measure the text.
 */
function renderButtonVml(
  data: any,
  border: any,
  padding: { top: number; right: number; bottom: number; left: number },
  href: string,
  fontFamily: string,
): string {
  const label = stripTags(data.text) || "";
  const fontSize = Number(data.fontSize) || 16;
  const borderWidth = Number(border.width) || 0;

  const height = Math.round(
    fontSize * 1.5 + padding.top + padding.bottom + borderWidth * 2,
  );
  // Rough average character width for the web-safe families in the picker.
  const width = Math.round(
    label.length * fontSize * 0.6 + padding.left + padding.right,
  );
  const radius = Number(data.borderRadius ?? 4);
  const arcsize = Math.min(50, Math.round((radius / Math.max(height, 1)) * 100));

  const sizeStyle = data.fullWidth
    ? "mso-width-percent: 1000;"
    : `width: ${Math.max(width, 1)}px;`;

  const stroke =
    borderWidth > 0
      ? `stroke="t" strokecolor="${escapeAttr(border.color || "#000000")}" strokeweight="${borderWidth}px"`
      : 'stroke="f"';

  const centerStyle = [
    `color: ${data.color || "#ffffff"}`,
    `font-family: ${fontFamily}`,
    `font-size: ${fontSize}px`,
    `font-weight: ${data.fontWeight || "bold"}`,
    `text-transform: ${data.textTransform || "none"}`,
  ].join("; ");

  return `<!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height: ${height}px; v-text-anchor: middle; ${sizeStyle}" arcsize="${arcsize}%" ${stroke} fillcolor="${escapeAttr(data.backgroundColor || "#3b82f6")}">
        <w:anchorlock/>
        <center style="${escapeAttr(centerStyle)}">${escapeAttr(label)}</center>
      </v:roundrect>
      <![endif]-->`;
}

function renderSpacer(block: any): string {
  const { data } = block;
  const height = data.height || 20;
  const style = [
    `height: ${height}px`,
    `line-height: ${height}px`,
    `font-size: ${height}px`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  return `
    <div style="${escapeAttr(style)}">&nbsp;</div>
  `;
}

function renderList(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);
  const Tag = data.listType === "ordered" ? "ol" : "ul";
  const listStyle = data.listType === "ordered" ? "decimal" : "disc";

  const style = [
    `margin: 0`,
    `font-family: ${globals.fontFamily}`,
    `text-align: ${data.align || "left"}`,
    `color: ${data.color || globals.textColor || "inherit"}`,
    `font-size: ${data.fontSize ? data.fontSize + "px" : "16px"}`,
    `line-height: ${data.lineHeight || 1.5}`,
    `font-weight: ${data.fontWeight || "normal"}`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  const itemsHtml = (data.items || [])
    .map((item: string) => `<li style="margin-bottom: 4px;">${item}</li>`)
    .join("");

  return `
    <div style="${escapeAttr(style)}">
      <${Tag} style="margin: 0; padding-left: 24px; list-style-type: ${escapeAttr(listStyle)};">
        ${itemsHtml}
      </${Tag}>
    </div>
  `;
}

function renderDivider(block: any): string {
  const { data } = block;
  const style = [
    `padding: ${renderPadding(data.padding)}`,
    `text-align: ${data.align || "center"}`,
    `font-size: 0px`,
    `line-height: 0px`,
  ].join("; ");

  const hrStyle = [
    `display: inline-block`,
    `width: ${data.width || 100}%`,
    `border-top: ${data.borderWidth || 1}px ${data.borderStyle || "solid"} ${
      data.color || "#cccccc"
    }`,
    `margin: 0`,
  ].join("; ");

  return `
    <div style="${escapeAttr(style)}">
      <div style="${escapeAttr(hrStyle)}">&nbsp;</div>
    </div>
  `;
}

function renderProductLine(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);
  const leftStyle = data.leftStyle || {};
  const rightStyle = data.rightStyle || {};

  const containerStyle = [`padding: ${renderPadding(data.padding)}`].join("; ");

  const tableStyle = [
    `width: 100%`,
    `border-collapse: collapse`,
    `border-spacing: 0`,
  ].join("; ");

  const leftCellStyle = [
    `text-align: left`,
    `font-family: ${leftStyle.fontFamily || globals.fontFamily}`,
    `font-size: ${leftStyle.fontSize || 14}px`,
    `line-height: ${leftStyle.lineHeight || 1.4}`,
    `color: ${leftStyle.color || globals.textColor || "#000000"}`,
    `font-weight: ${leftStyle.fontWeight || "normal"}`,
    `vertical-align: top`,
    `padding: 0`,
  ].join("; ");

  const rightCellStyle = [
    `text-align: right`,
    `width: ${data.rightWidth || 120}px`,
    `font-family: ${rightStyle.fontFamily || globals.fontFamily}`,
    `font-size: ${rightStyle.fontSize || 14}px`,
    `line-height: ${rightStyle.lineHeight || 1.4}`,
    `color: ${rightStyle.color || globals.textColor || "#000000"}`,
    `font-weight: ${rightStyle.fontWeight || "normal"}`,
    `white-space: nowrap`,
    `vertical-align: top`,
    `padding: 0`,
  ].join("; ");

  return `
    <div style="${escapeAttr(containerStyle)}">
      <table role="presentation" style="${escapeAttr(tableStyle)}">
        <tbody>
          <tr>
            <td style="${escapeAttr(leftCellStyle)}">
              ${data.leftText || ""}
            </td>
            <td style="${escapeAttr(rightCellStyle)}">
              ${data.rightText || ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
