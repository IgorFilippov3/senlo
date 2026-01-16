import { ContentBlock } from "../emailDesign";
import { renderPadding, normalizeUrl } from "./utils";
import { RenderOptions } from "./types";

export function renderMJMLBlock(block: ContentBlock, options?: RenderOptions): string {
  switch (block.type) {
    case "heading":
      return renderMJMLHeading(block);
    case "paragraph":
      return renderMJMLParagraph(block);
    case "image":
      return renderMJMLImage(block, options);
    case "button":
      return renderMJMLButton(block);
    case "spacer":
      return renderMJMLSpacer(block);
    case "list":
      return renderMJMLList(block);
    case "divider":
      return renderMJMLDivider(block);
    case "product-line":
      return renderMJMLProductLine(block);
    case "socials":
      return renderMJMLSocials(block, options);
    default:
      return `<!-- Unknown MJML block type: ${(block as any).type} -->`;
  }
}

function renderMJMLSocials(block: any, options?: RenderOptions): string {
  const { data } = block;
  const iconSize = data.size || 32;
  const spacing = data.spacing || 10;
  const padding = renderPadding(data.padding);

  const elements = (data.links || []).map((link: any) => {
    const iconSrc = normalizeUrl(link.icon, options?.baseUrl);
    return `<mj-social-element name="${link.type}-noshare" src="${iconSrc}" href="${link.url || "#"}" />`;
  });

  return `
        <mj-social 
          align="${data.align || "center"}" 
          font-size="12px" 
          icon-size="${iconSize}px" 
          mode="horizontal" 
          padding="${padding}"
          inner-padding="${spacing / 2}px"
        >
          ${elements.join("\n          ")}
        </mj-social>`;
}

function renderMJMLHeading(block: any): string {
  const { data } = block;
  return `
        <mj-text
          align="${data.align || "left"}"
          color="${data.color || "#000000"}"
          font-size="${data.fontSize || 24}px"
          line-height="${data.lineHeight || 1.3}"
          font-weight="${data.fontWeight || "bold"}"
          text-transform="${data.textTransform || "none"}"
          letter-spacing="${data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"}"
          padding="${renderPadding(data.padding)}"
        >
          ${data.href ? `<a href="${data.href}" style="color: inherit; text-decoration: none;">${data.text}</a>` : data.text}
        </mj-text>`;
}

function renderMJMLParagraph(block: any): string {
  const { data } = block;
  return `
        <mj-text
          align="${data.align || "left"}"
          color="${data.color || "#000000"}"
          font-size="${data.fontSize || 16}px"
          line-height="${data.lineHeight || 1.5}"
          font-weight="${data.fontWeight || "normal"}"
          text-transform="${data.textTransform || "none"}"
          letter-spacing="${data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"}"
          padding="${renderPadding(data.padding)}"
        >
          ${data.href ? `<a href="${data.href}" style="color: inherit; text-decoration: none;">${data.text}</a>` : data.text}
        </mj-text>`;
}

function renderMJMLImage(block: any, options?: RenderOptions): string {
  const { data } = block;
  const src = normalizeUrl(data.src, options?.baseUrl);
  return `
        <mj-image
          src="${src}"
          alt="${data.alt || ""}"
          width="${data.fullWidth ? "" : (data.width ? data.width + "px" : "")}"
          fluid-on-mobile="${data.fullWidth ? "true" : "false"}"
          align="${data.align || "center"}"
          border-radius="${data.borderRadius || 0}px"
          border="${data.border?.width ? `${data.border.width}px ${data.border.style} ${data.border.color}` : "none"}"
          padding="${renderPadding(data.padding)}"
          ${data.href ? `href="${data.href}"` : ""}
        />`;
}

function renderMJMLButton(block: any): string {
  const { data } = block;
  const padding = data.padding || { top: 12, right: 24, bottom: 12, left: 24 };
  return `
        <mj-button
          background-color="${data.backgroundColor || "#3b82f6"}"
          color="${data.color || "#ffffff"}"
          align="${data.align || "center"}"
          font-size="${data.fontSize || 16}px"
          font-weight="${data.fontWeight || "bold"}"
          border-radius="${data.borderRadius || 4}px"
          border="${data.border?.width ? `${data.border.width}px ${data.border.style} ${data.border.color}` : "none"}"
          padding="10px 0"
          inner-padding="${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px"
          text-transform="${data.textTransform || "none"}"
          letter-spacing="${data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"}"
          ${data.fullWidth ? 'width="100%"' : ""}
          ${data.href ? `href="${data.href}"` : ""}
        >
          ${data.text}
        </mj-button>`;
}

function renderMJMLSpacer(block: any): string {
  const { data } = block;
  return `
        <mj-spacer height="${data.height || 20}px" padding="${renderPadding(data.padding)}" />`;
}

function renderMJMLList(block: any): string {
  const { data } = block;
  const Tag = data.listType === "ordered" ? "ol" : "ul";
  const listStyle = data.listType === "ordered" ? "decimal" : "disc";
  const itemsHtml = (data.items || [])
    .map((item: string) => `<li>${item}</li>`)
    .join("");

  return `
        <mj-text
          align="${data.align || "left"}"
          color="${data.color || "#000000"}"
          font-size="${data.fontSize || 16}px"
          line-height="${data.lineHeight || 1.5}"
          font-weight="${data.fontWeight || "normal"}"
          padding="${renderPadding(data.padding)}"
        >
          <${Tag} style="margin: 0; padding-left: 20px; list-style-type: ${listStyle};">
            ${itemsHtml}
          </${Tag}>
        </mj-text>`;
}

function renderMJMLDivider(block: any): string {
  const { data } = block;
  return `
        <mj-divider
          border-width="${data.borderWidth || 1}px"
          border-style="${data.borderStyle || "solid"}"
          border-color="${data.color || "#cccccc"}"
          width="${data.width || 100}%"
          align="${data.align || "center"}"
          padding="${renderPadding(data.padding)}"
        />`;
}

function renderMJMLProductLine(block: any): string {
  const { data } = block;
  const leftStyle = data.leftStyle || {};
  const rightStyle = data.rightStyle || {};
  
  return `
        <mj-text padding="${renderPadding(data.padding)}">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;">
            <tr>
              <td align="left" style="font-family: ${leftStyle.fontFamily || 'Arial, sans-serif'}; font-size: ${leftStyle.fontSize || 14}px; line-height: ${leftStyle.lineHeight || 1.4}; color: ${leftStyle.color || '#000000'}; font-weight: ${leftStyle.fontWeight || 'normal'};">
                ${data.leftText}
              </td>
              <td align="right" width="${data.rightWidth || 120}" style="width: ${data.rightWidth || 120}px; font-family: ${rightStyle.fontFamily || 'Arial, sans-serif'}; font-size: ${rightStyle.fontSize || 14}px; line-height: ${rightStyle.lineHeight || 1.4}; color: ${rightStyle.color || '#000000'}; font-weight: ${rightStyle.fontWeight || 'normal'}; white-space: nowrap;">
                ${data.rightText}
              </td>
            </tr>
          </table>
        </mj-text>`;
}






