// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmailDesignDocument } from "@senlo/core";
import type { StarterTemplate } from "./types";

const design = {
  "rows": [
    {
      "id": "BphAlDzl44ziVXl3N98qe",
      "type": "row",
      "columns": [
        {
          "id": "1-36tqxYy38bF69Yj0Fjn",
          "width": 100,
          "blocks": [
            {
              "id": "B8rGNkivVRjtA9_XywTPx",
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
        "padding": {
          "top": 16,
          "left": 16,
          "right": 16,
          "bottom": 16
        },
        "fullWidth": false,
        "backgroundColor": "#ffffff00"
      }
    },
    {
      "id": "mZvXkD_wi_NUkVpkeqixx",
      "type": "row",
      "columns": [
        {
          "id": "n-EQ9_YC02Yz6zHeF4uOz",
          "width": 100,
          "blocks": [
            {
              "id": "4dyjHVzz_FVLa-C7mAWO9",
              "data": {
                "href": "",
                "text": "Sign in to Acme",
                "align": "center",
                "color": "#18181b",
                "level": 2,
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 12
                }
              },
              "type": "heading"
            },
            {
              "id": "vpfstJ0RP04PUtOWg9u0b",
              "data": {
                "href": "",
                "text": "Hi Amelia, use the button below to sign in as <strong>amelia.hart@example.com</strong>. No password needed.",
                "align": "center",
                "color": "#3f3f46",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 24
                },
                "fontSize": 16
              },
              "type": "paragraph"
            },
            {
              "id": "taWKt744YNELqJdTa_943",
              "data": {
                "href": "",
                "text": "Sign in",
                "align": "center",
                "border": {},
                "margin": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
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
              "id": "_md_qLRDdjM49mC5tOIc6",
              "data": {
                "href": "",
                "text": "This link expires in <strong>15 minutes</strong> and works only once.",
                "align": "center",
                "color": "#71717a",
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
              "id": "svGgLu77DHM54JOyEaLl-",
              "data": {
                "align": "center",
                "color": "#d4d4d8",
                "width": 100,
                "padding": {
                  "top": 24,
                  "left": 0,
                  "right": 0,
                  "bottom": 24
                },
                "borderStyle": "solid",
                "borderWidth": 1
              },
              "type": "divider"
            },
            {
              "id": "CBtiEi7t1QNgsclB_FlUL",
              "data": {
                "href": "",
                "text": "OR ENTER THIS CODE",
                "align": "center",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 12
                },
                "fontSize": 14,
                "fontWeight": "bold"
              },
              "type": "paragraph"
            },
            {
              "id": "kef2dUeDZTmQ0kRqoqN11",
              "data": {
                "href": "",
                "text": "482913",
                "align": "center",
                "color": "#18181b",
                "border": {
                  "color": "#d4d4d8",
                  "width": 1
                },
                "padding": {
                  "top": 16,
                  "left": 16,
                  "right": 16,
                  "bottom": 16
                },
                "fontSize": 32,
                "fontWeight": "bold",
                "borderRadius": 10,
                "letterSpacing": 10,
                "backgroundColor": "#f4f4f5"
              },
              "type": "paragraph"
            },
            {
              "id": "9P18VEkQNjQPT_PFgJqu-",
              "data": {
                "href": "",
                "text": "Type it on the sign-in screen if you opened this email on another device.",
                "align": "left",
                "color": "#71717a",
                "border": {},
                "margin": {
                  "top": 8,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 14
              },
              "type": "paragraph"
            },
            {
              "id": "KRD4yuVZuBdn8Tri4dJxJ",
              "data": {
                "items": [
                  {
                    "left": "Requested",
                    "right": "Oct 9, 2026 at 13:42 CEST"
                  },
                  {
                    "left": "Device",
                    "right": "Safari on iPhone"
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
                "margin": {
                  "top": 32,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "divider": {
                  "color": "#ececef",
                  "width": 1
                },
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
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
                "rightWidth": 300,
                "rowPadding": {
                  "top": 12,
                  "left": 8,
                  "right": 8,
                  "bottom": 12
                },
                "borderRadius": 8,
                "backgroundColor": "#fafafa"
              },
              "type": "product-line"
            },
            {
              "id": "E6EGnpeMdqh4993g65P_E",
              "data": {
                "href": "",
                "text": "Didn't try to sign in? You can ignore this email. Nobody can access your account without this link or code.",
                "align": "left",
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
              "id": "dHQX42Hw_K0WpYO5F2O_-",
              "data": {
                "align": "center",
                "color": "#d4d4d8",
                "width": 100,
                "padding": {
                  "top": 2,
                  "left": 0,
                  "right": 0,
                  "bottom": 12
                },
                "borderStyle": "solid",
                "borderWidth": 1
              },
              "type": "divider"
            },
            {
              "id": "n_9eBKGTvpAVgzpr5bw9A",
              "data": {
                "href": "",
                "text": "Button not working? Copy and paste this link into your browser:\n<a href=\"https://app.acme.example/auth/magic?token=c7e19b04a2f8\">https://app.acme.example/auth/magic?token=c7e19b04a2f8</a>",
                "align": "left",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
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
    },
    {
      "id": "BM4LRimSSJIWajos9bMN4",
      "type": "row",
      "columns": [
        {
          "id": "HWQ96Bf8IVUIKIQzOOKLN",
          "width": 100,
          "blocks": [
            {
              "id": "2tZa0SYdMVNaopl3IipXO",
              "data": {
                "href": "",
                "text": "This is an automated sign-in email from Acme. Never share this link or code with anyone, including our team.",
                "align": "center",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 13
              },
              "type": "paragraph"
            },
            {
              "id": "LGBGxmhWDzkP5KY17y4Ja",
              "data": {
                "href": "",
                "text": "<a href=\"#\">Contact support</a>",
                "align": "center",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 13,
                "lineHeight": 1.2
              },
              "type": "paragraph"
            }
          ]
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "margin": {
          "top": 24,
          "left": 0,
          "right": 0,
          "bottom": 24
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
    }
  ],
  "version": 4,
  "settings": {
    "textColor": "#111827",
    "fontFamily": "Arial, sans-serif",
    "contentWidth": 600,
    "backgroundColor": "#f4f4f5"
  }
} as EmailDesignDocument;

export const MAGIC_LINK_TEMPLATE: StarterTemplate = {
  name: "Magic link",
  subject: "Your Acme sign-in link",
  preheader: "Sign in with one click or use code 482913. The link expires in 15 minutes.",
  design,
};
