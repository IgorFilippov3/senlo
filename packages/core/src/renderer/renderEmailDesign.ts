import { EmailDesignDocument } from "../emailDesign";
import { RenderContext, RenderOptions } from "./types";
import { renderHead } from "./renderHead";
import { renderBody } from "./renderBody";
import { replaceMergeTags } from "../merge-tags";

export function renderEmailDesign(
  design: EmailDesignDocument,
  options?: RenderOptions
): string {
  const context: RenderContext = {
    responsiveStyles: [],
  };

  const headContent = renderHead(design, context);
  const bodyContent = renderBody(design.rows, design, context);

  let html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <title></title>
  ${headContent}
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:${design.settings.backgroundColor || "#ffffff"};">
  <div role="article" aria-roledescription="email" lang="en" style="-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:${design.settings.backgroundColor || "#ffffff"};">
    ${bodyContent}
  </div>
</body>
</html>
  `.trim();

  if (options?.data) {
    html = replaceMergeTags(html, options.data);
  }

  return html;
}










