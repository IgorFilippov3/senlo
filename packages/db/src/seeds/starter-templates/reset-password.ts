// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmailDesignDocument } from "@senlo/core";
import type { StarterTemplate } from "./types";

const design = {
  "rows": [
    {
      "id": "m9agmsUBxqHoaDvbNIdzY",
      "type": "row",
      "columns": [
        {
          "id": "gvQNDQgbX15n4C5xX9yD8",
          "width": 100,
          "blocks": [
            {
              "id": "7968oszno7ICU2R0WZ2bF",
              "data": {
                "alt": "Acme",
                "src": "/logoipsum.png",
                "href": "",
                "align": "center",
                "width": 300,
                "border": {}
              },
              "type": "image"
            }
          ]
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "margin": {
          "top": 12,
          "left": 0,
          "right": 0,
          "bottom": 12
        },
        "padding": {
          "top": 0,
          "left": 16,
          "right": 16,
          "bottom": 0
        },
        "fullWidth": false,
        "backgroundColor": "#ffffff00"
      }
    },
    {
      "id": "5oN-tgKLsDrmxZlAcPFVF",
      "type": "row",
      "columns": [
        {
          "id": "lnRaUnIXGSR7N_Addj1I0",
          "width": 100,
          "blocks": [
            {
              "id": "xs854njS8-pKiIfNv2_2H",
              "data": {
                "href": "",
                "text": "Reset your password",
                "align": "center",
                "color": "#18181b",
                "level": 2,
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 26
              },
              "type": "heading"
            },
            {
              "id": "NR8P6jDRQe4476NEfHntM",
              "data": {
                "href": "",
                "text": "Hi Amelia, we received a request to reset the password for your Acme account <strong>amelia.hart@example.com</strong>. Click the button below to choose a new one.",
                "align": "center",
                "color": "#3f3f46",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                },
                "fontSize": 16
              },
              "type": "paragraph"
            },
            {
              "id": "qD-Gd_4HgnAntrkl1AFKz",
              "data": {
                "href": "",
                "text": "Reset password",
                "align": "center",
                "border": {},
                "shadow": {},
                "padding": {
                  "top": 14,
                  "left": 28,
                  "right": 28,
                  "bottom": 14
                },
                "borderRadius": 8,
                "backgroundColor": "#4f46e5"
              },
              "type": "button"
            },
            {
              "id": "-M2guJDBF_lki6xFcgtww",
              "data": {
                "href": "",
                "text": "This link expires in <strong>60 minutes</strong> and can only be used once.",
                "align": "center",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                },
                "fontSize": 14
              },
              "type": "paragraph"
            },
            {
              "id": "CAWnPjMoCPmHCktIYcf73",
              "data": {
                "items": [
                  {
                    "left": "Requested",
                    "right": "Oct 9, 2026 at 13:42 CEST"
                  },
                  {
                    "left": "Device",
                    "right": "Chrome on macOS"
                  },
                  {
                    "left": "Location",
                    "right": "Berlin, Germany"
                  }
                ],
                "border": {
                  "color": "#ececef",
                  "width": 1
                },
                "divider": {
                  "width": 1
                },
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "leftAlign": "left",
                "leftStyle": {
                  "color": "#71717a",
                  "fontSize": 14,
                  "fontFamily": "Arial, sans-serif",
                  "fontWeight": "normal",
                  "lineHeight": 1.4
                },
                "rightAlign": "left",
                "rightStyle": {
                  "color": "#27272a",
                  "fontSize": 14,
                  "fontFamily": "Arial, sans-serif",
                  "fontWeight": "normal",
                  "lineHeight": 1.4
                },
                "rightWidth": 260,
                "rowPadding": {
                  "top": 8,
                  "left": 12,
                  "right": 12,
                  "bottom": 8
                },
                "borderRadius": 8,
                "verticalAlign": "top",
                "backgroundColor": "#fafafa"
              },
              "type": "product-line"
            },
            {
              "id": "bzKYIr8D1wFrIRSi_B9Gy",
              "data": {
                "href": "",
                "text": "Didn't request this? You can safely ignore this email. Your password won't change until you create a new one.",
                "align": "left",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 24
                },
                "fontSize": 14
              },
              "type": "paragraph"
            },
            {
              "id": "JIFlEXdLonAkEBorxEftP",
              "data": {
                "align": "center",
                "color": "#cccccc",
                "width": 100,
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "borderStyle": "solid",
                "borderWidth": 1
              },
              "type": "divider"
            },
            {
              "id": "zMZzRu5-XAjL3xgA_dk7m",
              "data": {
                "href": "",
                "text": "Button not working? Copy and paste this link into your browser:\n<a href=\"https://app.acme.example/reset?token=8f2c1e9a4b7d\">https://app.acme.example/reset?token=8f2c1e9a4b7d</a>",
                "align": "left",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 16,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                },
                "fontSize": 13
              },
              "type": "paragraph"
            }
          ]
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "padding": {
          "top": 40,
          "left": 40,
          "right": 40,
          "bottom": 40
        },
        "fullWidth": false,
        "borderRadius": {
          "top": 12,
          "bottom": 12
        },
        "backgroundColor": "#ffffff"
      }
    }
  ],
  "version": 4,
  "settings": {
    "textColor": "#111827",
    "fontFamily": "Arial, sans-serif",
    "contentWidth": 600,
    "backgroundColor": "#ffffff00"
  }
} as EmailDesignDocument;

export const RESET_PASSWORD_TEMPLATE: StarterTemplate = {
  name: "Reset your password",
  subject: "Reset your Acme password",
  preheader: "Choose a new password. This link expires in 60 minutes and works only once.",
  design,
};
