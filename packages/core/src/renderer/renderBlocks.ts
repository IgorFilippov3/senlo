import { ContentBlock } from "../emailDesign";
import { RenderContext } from "./types";
import { renderPadding, normalizeUrl } from "./utils";

export function renderBlock(
  block: ContentBlock,
  context: RenderContext
): string {
  switch (block.type) {
    case "heading":
      return renderHeading(block);
    case "paragraph":
      return renderParagraph(block);
    case "image":
      return renderImage(block, context);
    case "button":
      return renderButton(block);
    case "spacer":
      return renderSpacer(block);
    case "list":
      return renderList(block);
    case "divider":
      return renderDivider(block);
    case "product-line":
      return renderProductLine(block);
    case "socials":
      return renderSocials(block, context);
    default:
      return `<!-- Unknown block type: ${(block as any).type} -->`;
  }
}

function renderSocials(block: any, context: RenderContext): string {
  const { data } = block;
  const iconSize = data.size || 32;
  const spacing = data.spacing || 10;
  const padding = renderPadding(data.padding);

  const containerStyle = [
    `padding: ${padding}`,
    `text-align: ${data.align || "center"}`,
  ].join("; ");

  const linksHtml = (data.links || [])
    .map((link: any) => {
      const iconSrc = normalizeUrl(link.icon, context.options?.baseUrl);
      const imgHtml = `<img src="${iconSrc}" alt="${link.type}" width="${iconSize}" height="${iconSize}" style="display: inline-block; border-radius: 4px;" />`;
      if (link.url) {
        return `<a href="${link.url}" target="_blank" style="text-decoration: none; margin: 0 ${spacing / 2}px; display: inline-block;">${imgHtml}</a>`;
      }
      return `<span style="margin: 0 ${spacing / 2}px; display: inline-block;">${imgHtml}</span>`;
    })
    .join("");

  return `<div style="${containerStyle}">${linksHtml}</div>`;
}

function renderHeading(block: any): string {
  const { data } = block;
  const level = data.level || 2;
  const Tag = `h${level}`;

  const style = [
    `margin: 0`,
    `text-align: ${data.align || "left"}`,
    `color: ${data.color || "inherit"}`,
    `font-size: ${data.fontSize ? data.fontSize + "px" : "inherit"}`,
    `line-height: ${data.lineHeight || 1.3}`,
    `font-weight: ${data.fontWeight || "bold"}`,
    `text-transform: ${data.textTransform || "none"}`,
    `letter-spacing: ${
      data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"
    }`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  let content = data.text;
  if (data.href) {
    content = `<a href="${data.href}" target="_blank" style="color: inherit; text-decoration: none;">${content}</a>`;
  }

  return `<${Tag} style="${style}">${content}</${Tag}>`;
}

function renderParagraph(block: any): string {
  const { data } = block;

  const style = [
    `margin: 0`,
    `text-align: ${data.align || "left"}`,
    `color: ${data.color || "inherit"}`,
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
    content = `<a href="${data.href}" target="_blank" style="color: inherit; text-decoration: none;">${content}</a>`;
  }

  return `<p style="${style}">${content}</p>`;
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

  const src = normalizeUrl(data.src, context.options?.baseUrl);
  let html = `<img src="${src}" alt="${data.alt || ""}" width="${
    data.width || ""
  }" style="${imgStyle}" />`;

  if (data.href) {
    html = `<a href="${data.href}" target="_blank" style="text-decoration: none; display: inline-block;">${html}</a>`;
  }

  return `<div style="${containerStyle}">${html}</div>`;
}

function renderButton(block: any): string {
  const { data } = block;

  const padding = data.padding || { top: 12, right: 24, bottom: 12, left: 24 };
  const border = data.border || { width: 0, style: "solid", color: "#000000" };

  const btnStyle = [
    `background-color: ${data.backgroundColor || "#3b82f6"}`,
    `color: ${data.color || "#ffffff"}`,
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
    `border: ${border.width}px ${border.style} ${border.color}`,
    `box-shadow: ${
      data.shadow
        ? `${data.shadow.x}px ${data.shadow.y}px ${data.shadow.blur}px ${data.shadow.color}`
        : "none"
    }`,
    `text-align: center`,
  ].join("; ");

  return `
    <div style="text-align: ${data.align || "center"}; padding: 10px 0;">
      <a href="${data.href || "#"}" target="_blank" style="${btnStyle}">
        ${data.text}
      </a>
    </div>
  `;
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
    <div style="${style}">&nbsp;</div>
  `;
}

function renderList(block: any): string {
  const { data } = block;
  const Tag = data.listType === "ordered" ? "ol" : "ul";
  const listStyle = data.listType === "ordered" ? "decimal" : "disc";

  const style = [
    `margin: 0`,
    `text-align: ${data.align || "left"}`,
    `color: ${data.color || "inherit"}`,
    `font-size: ${data.fontSize ? data.fontSize + "px" : "16px"}`,
    `line-height: ${data.lineHeight || 1.5}`,
    `font-weight: ${data.fontWeight || "normal"}`,
    // `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  const itemsHtml = (data.items || [])
    .map((item: string) => `<li style="margin-bottom: 4px;">${item}</li>`)
    .join("");

  return `
    <div style="${style}">
      <${Tag} style="margin: 0; padding-left: 24px; list-style-type: ${listStyle};">
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
    <div style="${style}">
      <div style="${hrStyle}">&nbsp;</div>
    </div>
  `;
}

function renderProductLine(block: any): string {
  const { data } = block;
  const leftStyle = data.leftStyle || {};
  const rightStyle = data.rightStyle || {};

  const containerStyle = [
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  const tableStyle = [
    `width: 100%`,
    `border-collapse: collapse`,
    `border-spacing: 0`,
  ].join("; ");

  const leftCellStyle = [
    `text-align: left`,
    `font-family: ${leftStyle.fontFamily || 'Arial, sans-serif'}`,
    `font-size: ${leftStyle.fontSize || 14}px`,
    `line-height: ${leftStyle.lineHeight || 1.4}`,
    `color: ${leftStyle.color || '#000000'}`,
    `font-weight: ${leftStyle.fontWeight || 'normal'}`,
    `vertical-align: top`,
    `padding: 0`,
  ].join("; ");

  const rightCellStyle = [
    `text-align: right`,
    `width: ${data.rightWidth || 120}px`,
    `font-family: ${rightStyle.fontFamily || 'Arial, sans-serif'}`,
    `font-size: ${rightStyle.fontSize || 14}px`,
    `line-height: ${rightStyle.lineHeight || 1.4}`,
    `color: ${rightStyle.color || '#000000'}`,
    `font-weight: ${rightStyle.fontWeight || 'normal'}`,
    `white-space: nowrap`,
    `vertical-align: top`,
    `padding: 0`,
  ].join("; ");

  return `
    <div style="${containerStyle}">
      <table role="presentation" style="${tableStyle}">
        <tbody>
          <tr>
            <td style="${leftCellStyle}">
              ${data.leftText || ''}
            </td>
            <td style="${rightCellStyle}">
              ${data.rightText || ''}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
