import { EmailDesignDocument } from "../emailDesign";
import { RenderContext } from "./types";
import { escapeCssValue } from "./escape";

export function renderHead(design: EmailDesignDocument, context: RenderContext): string {
  const { responsiveStyles } = context;
  const fontFamily =
    escapeCssValue(design.settings.fontFamily) || "Arial, sans-serif";

  return `
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    div[style*="margin: 16px 0;"] { margin: 0 !important; }
    
    * {
      font-family: ${fontFamily};
    }

    ${responsiveStyles.join("\n")}

    @media only screen and (max-width: ${Number(design.settings.contentWidth) || 600}px) {
      .senlo-full-width {
        width: 100% !important;
      }
      .senlo-stack {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        direction: ltr !important;
      }
    }
  </style>
  `;
}









