// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmailDesignDocument } from "@senlo/core";
import type { StarterTemplate } from "./types";

const design = {
  "rows": [
    {
      "id": "Njml4vtiE_1UemLsTzY4f",
      "type": "row",
      "columns": [
        {
          "id": "xXJqmkFWPFZ0sLSC0fqHo",
          "width": 100,
          "blocks": [
            {
              "id": "ea-HNDMYXmm9V-2GImegI",
              "data": {
                "alt": "Acme",
                "src": "/logoipsum.png",
                "href": "",
                "align": "left",
                "width": 300,
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "borderRadius": 12
              },
              "type": "image"
            },
            {
              "id": "f-O9gPYQP3usoHSKSvnsX",
              "data": {
                "href": "",
                "text": "Verify your login",
                "align": "left",
                "color": "#353535",
                "level": 2,
                "border": {},
                "padding": {
                  "top": 24,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 32
              },
              "type": "heading"
            },
            {
              "id": "l-oKKEUmo930L1fPlugSB",
              "data": {
                "href": "",
                "text": "We detected a new sign-in to your account. If this was you, confirm below to continue.",
                "align": "left",
                "color": "#353535",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                }
              },
              "type": "paragraph"
            },
            {
              "id": "xcKEZLGroxjwPzvnhb2UH",
              "data": {
                "items": [
                  {
                    "left": "DEVICE",
                    "right": "Chrome on macOS"
                  },
                  {
                    "left": "LOCATION",
                    "right": "Berlin, Germany"
                  },
                  {
                    "left": "IP ADDRESS",
                    "right": "203.0.113.42"
                  }
                ],
                "border": {
                  "color": "#F0F0EE",
                  "width": 1
                },
                "divider": {
                  "color": "#F0F0EE",
                  "style": "solid",
                  "width": 1
                },
                "padding": {
                  "top": 24,
                  "left": 32,
                  "right": 32,
                  "bottom": 24
                },
                "leftStyle": {
                  "color": "#999999",
                  "fontSize": 16,
                  "fontFamily": "Arial, sans-serif",
                  "fontWeight": "normal",
                  "lineHeight": 1.4
                },
                "rightStyle": {
                  "color": "#353535",
                  "fontSize": 16,
                  "fontFamily": "Arial, sans-serif",
                  "fontWeight": "normal",
                  "lineHeight": 1.4
                },
                "rightWidth": 120,
                "rowPadding": {
                  "top": 14,
                  "left": 0,
                  "right": 0,
                  "bottom": 14
                },
                "borderRadius": 8,
                "backgroundColor": "#FAFAF9"
              },
              "type": "product-line"
            },
            {
              "id": "e117c4rBF6gEBhw1P08dD",
              "data": {
                "href": "",
                "text": "Verify this login",
                "align": "center",
                "border": {
                  "color": "#353535"
                },
                "shadow": {
                  "x": 0,
                  "y": 0,
                  "blur": 0,
                  "color": "#000000"
                },
                "padding": {
                  "top": 12,
                  "left": 32,
                  "right": 32,
                  "bottom": 12
                },
                "fontSize": 18,
                "fullWidth": true,
                "fontWeight": "normal",
                "borderRadius": 8,
                "letterSpacing": 1,
                "backgroundColor": "#353535"
              },
              "type": "button"
            },
            {
              "id": "TgPAMj3cYT2FfGeKe2qPY",
              "data": {
                "href": "",
                "text": "or enter this OTP code manually",
                "align": "center",
                "color": "#999999",
                "border": {},
                "margin": {
                  "top": 12,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontWeight": "bold"
              },
              "type": "paragraph"
            },
            {
              "id": "EKkHvoXl7WSik629pq9pE",
              "data": {
                "href": "",
                "text": "153 860",
                "align": "center",
                "color": "#353535",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                },
                "fontSize": 40,
                "fontWeight": "bold",
                "letterSpacing": 4
              },
              "type": "paragraph"
            },
            {
              "id": "1OHzOS05uUarzfMwxnDr6",
              "data": {
                "href": "",
                "text": "Expires in 10 minutes",
                "align": "center",
                "color": "#999999",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                },
                "fontWeight": "bold"
              },
              "type": "paragraph"
            },
            {
              "id": "PEydCt_WqAvsDQG5fpa3G",
              "data": {
                "href": "",
                "text": "If you didn't attempt this login, your account may be compromised. <a href=\"#\" target=\"_blank\">Secure your account→</a>",
                "align": "left",
                "color": "#867251",
                "border": {
                  "color": "#F9ECE3",
                  "width": 1
                },
                "padding": {
                  "top": 10,
                  "left": 24,
                  "right": 24,
                  "bottom": 10
                },
                "borderRadius": 6,
                "backgroundColor": "#FFFCF7"
              },
              "type": "paragraph"
            }
          ]
        }
      ],
      "settings": {
        "align": "center",
        "padding": {
          "top": 42,
          "left": 32,
          "right": 32,
          "bottom": 42
        },
        "fullWidth": false,
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "iPzvn7144F0DTmisYSSox",
      "type": "row",
      "columns": [
        {
          "id": "kd7Rt2F2aKKg3dmXrPjY2",
          "width": 100,
          "blocks": [
            {
              "id": "mTehWtQPJTVJ-D5BuW_kf",
              "data": {
                "align": "center",
                "color": "#EBEBEB",
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
              "id": "pqZUaCiZjLT2WKn9epjIp",
              "data": {
                "href": "",
                "text": "You are receiving this because of a sign-in attempt on your Acme account.",
                "align": "center",
                "color": "#999999",
                "border": {},
                "margin": {
                  "top": 24,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                }
              },
              "type": "paragraph"
            },
            {
              "id": "WMmcOb-_TMHl5pvwYGyv9",
              "data": {
                "href": "",
                "text": "<a href=\"#\">Privacy</a> • <a href=\"#\">Help Center</a>",
                "align": "center",
                "color": "#999999",
                "border": {},
                "margin": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 24
                },
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "letterSpacing": 0.5
              },
              "type": "paragraph"
            }
          ]
        }
      ],
      "settings": {
        "align": "center",
        "padding": {
          "top": 0,
          "left": 0,
          "right": 0,
          "bottom": 0
        },
        "fullWidth": false,
        "backgroundColor": "#ffffff"
      }
    }
  ],
  "version": 3,
  "settings": {
    "textColor": "#111827",
    "fontFamily": "'Helvetica Neue', Helvetica, sans-serif",
    "contentWidth": 600,
    "backgroundColor": "#f3f3f3"
  }
} as EmailDesignDocument;

export const VERIFY_LOGIN_TEMPLATE: StarterTemplate = {
  name: "Verify your login",
  subject: "Confirm your new sign-in to Acme",
  preheader: "New sign-in from Chrome on macOS. Your code expires in 10 minutes.",
  design,
};
