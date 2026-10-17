// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmailDesignDocument } from "@senlo/core";
import type { StarterTemplate } from "./types";

const design = {
  "rows": [
    {
      "id": "3t2BfpX62XAqQdZ5wBf1r",
      "type": "row",
      "columns": [
        {
          "id": "ykfq1CNSKmzx9IZKl75nh",
          "width": 100,
          "blocks": [
            {
              "id": "u4x6P6T5OrEh6o2INJkmo",
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
          "top": 16,
          "left": 0,
          "right": 0,
          "bottom": 16
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
      "id": "2RZ1BKzGsIzLOODO3o0Am",
      "type": "row",
      "columns": [
        {
          "id": "7ylBk_XEOJZMc4STn1smi",
          "width": 100,
          "blocks": [
            {
              "id": "5yKqi3lz-YU_Hl1Gcur53",
              "data": {
                "href": "",
                "text": "SHIPPING UPDATE",
                "align": "center",
                "color": "#16a34a",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 14,
                "fontWeight": "bold",
                "textTransform": "uppercase"
              },
              "type": "paragraph"
            },
            {
              "id": "ybx2kCtxxkatHCCvQQA-E",
              "data": {
                "href": "",
                "text": "Your order is on its way",
                "align": "center",
                "color": "#18181b",
                "border": {},
                "padding": {
                  "top": 8,
                  "left": 0,
                  "right": 0,
                  "bottom": 8
                },
                "fontSize": 26,
                "fontWeight": "bold",
                "letterSpacing": 0.5
              },
              "type": "paragraph"
            },
            {
              "id": "rWHQZZm3MpT__sOGOIgSe",
              "data": {
                "href": "",
                "text": "Hi Amelia, order <strong>#10482</strong> has left our warehouse and is now with DHL Express.",
                "align": "center",
                "color": "#3f3f46",
                "border": {},
                "margin": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "padding": {
                  "top": 0,
                  "left": 26,
                  "right": 26,
                  "bottom": 0
                }
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
          "top": 36,
          "left": 36,
          "right": 36,
          "bottom": 0
        },
        "fullWidth": false,
        "borderRadius": {
          "top": 12
        },
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "25Z-Y-81n7y7LAFKiAo8R",
      "type": "row",
      "columns": [
        {
          "id": "GjLlz_KyhZxt6Pi0Mo9H3",
          "width": 100,
          "blocks": [
            {
              "id": "i1cgLJpHmu0T-nLW0W0SP",
              "data": {
                "href": "",
                "text": "Estimated delivery",
                "align": "center",
                "color": "#15803d",
                "border": {},
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
              "id": "tenccxjJcCy5j9tZNjQTv",
              "data": {
                "href": "",
                "text": "Thursday, Oct 15",
                "align": "center",
                "color": "#15803d",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 22,
                "fontWeight": "bold"
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {
              "color": "#bbf7d0",
              "width": 1
            },
            "margin": {
              "top": 24,
              "left": 24,
              "right": 24,
              "bottom": 24
            },
            "padding": {
              "top": 16,
              "left": 16,
              "right": 16,
              "bottom": 16
            },
            "borderRadius": 10,
            "backgroundColor": "#f0fdf4"
          }
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "margin": {
          "top": 0,
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
        "fullWidth": false,
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "Y5iTyxkHJSqLxEbFaDcGA",
      "type": "row",
      "columns": [
        {
          "id": "tgLVqE-vA1PUKBtPgyU7k",
          "width": 100,
          "blocks": [
            {
              "id": "4A9A_zSKiEjvsWIgwp_H-",
              "data": {
                "gap": 6,
                "steps": [
                  {
                    "label": "Ordered",
                    "value": "ordered",
                    "previewState": "completed"
                  },
                  {
                    "label": "Shipped",
                    "value": "shipped",
                    "previewState": "completed"
                  },
                  {
                    "label": "Out for delivery",
                    "value": "out_for_delivery",
                    "previewState": "active"
                  },
                  {
                    "label": "Delivered",
                    "value": "delivered",
                    "previewState": "pending"
                  }
                ],
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 12,
                "barHeight": 6,
                "barRadius": 3,
                "labelAlign": "left",
                "showLabels": true,
                "activeColor": "#16a34a",
                "labelSpacing": 8,
                "pendingColor": "#e4e4e7",
                "completedColor": "#16a34a",
                "statusVariable": "custom.shipment.status",
                "activeLabelColor": "#16a34a",
                "pendingLabelColor": "#a1a1aa"
              },
              "type": "progress"
            }
          ]
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "padding": {
          "top": 0,
          "left": 36,
          "right": 36,
          "bottom": 0
        },
        "fullWidth": false,
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "BgihG4WEEgIcuG9LZayrF",
      "type": "row",
      "columns": [
        {
          "id": "pb_YervJ2aPXJeow3t2v8",
          "width": 100,
          "blocks": [
            {
              "id": "lX94N5_dExYY0xyGr6rCo",
              "data": {
                "href": "",
                "text": "Track your package",
                "align": "center",
                "border": {},
                "margin": {
                  "top": 24,
                  "left": 0,
                  "right": 0,
                  "bottom": 24
                },
                "shadow": {},
                "padding": {
                  "top": 14,
                  "left": 28,
                  "right": 28,
                  "bottom": 14
                },
                "fullWidth": false,
                "borderRadius": 8,
                "backgroundColor": "#18181b"
              },
              "type": "button"
            },
            {
              "id": "CgxV3GhsjdXzmiqzatiqf",
              "data": {
                "items": [
                  {
                    "left": "Carrier",
                    "right": "DHL Express"
                  },
                  {
                    "left": "Tracking number",
                    "right": "JD014600006281734502"
                  },
                  {
                    "left": "Method",
                    "right": "Express, 2 to 3 business days"
                  },
                  {
                    "left": "Ship to",
                    "right": "Amelia Hart, 88 Alder Road, 10115 Berlin, Germany"
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
                "backgroundColor": "#fafafa"
              },
              "type": "product-line"
            }
          ]
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "padding": {
          "top": 0,
          "left": 36,
          "right": 36,
          "bottom": 0
        },
        "fullWidth": false,
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "qqJr38TrxkJjOB6vn9TGA",
      "type": "row",
      "columns": [
        {
          "id": "IKFkAR2SThrNgbpKiojpP",
          "width": 100,
          "blocks": [
            {
              "id": "64XfgKrOiFLOoJtpFpnnZ",
              "data": {
                "align": "center",
                "color": "#cccccc",
                "width": 100,
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                },
                "borderStyle": "solid",
                "borderWidth": 1
              },
              "type": "divider"
            },
            {
              "id": "r8cYNMBqiqgHZauELjPGR",
              "data": {
                "href": "",
                "text": "In this shipment",
                "align": "left",
                "color": "#18181b",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 6,
                  "right": 6,
                  "bottom": 0
                },
                "fontWeight": "bold"
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
          "top": 0,
          "left": 36,
          "right": 36,
          "bottom": 0
        },
        "fullWidth": false,
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "8td_QTAGnQ49Szp5UD69f",
      "type": "row",
      "columns": [
        {
          "id": "7iY6vZkTtkj5G7-98pzZK",
          "width": 22,
          "blocks": [
            {
              "id": "3N0pVTgWWj8llNgLzHhGX",
              "data": {
                "href": "",
                "text": "Shirt",
                "align": "center",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                }
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 0,
              "right": 0,
              "bottom": 6
            },
            "padding": {
              "top": 18,
              "left": 0,
              "right": 0,
              "bottom": 18
            },
            "borderRadius": 8,
            "backgroundColor": "#cecccc"
          }
        },
        {
          "id": "YdGUgmFbHKd-IDlerLftg",
          "width": 43,
          "blocks": [
            {
              "id": "EycIZeqjxb7k1qpZaiL11",
              "data": {
                "href": "",
                "text": "Linen overshirt",
                "align": "left",
                "color": "#18181b",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 15,
                "fontWeight": "bold"
              },
              "type": "paragraph"
            },
            {
              "id": "l8F_iYMxHLlj6wj6-N5pK",
              "data": {
                "href": "",
                "text": "Sand / M",
                "align": "left",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 14
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 16,
              "right": 16,
              "bottom": 6
            }
          }
        },
        {
          "id": "XKfVKyke_wlUOifI-MaS_",
          "width": 35,
          "blocks": [
            {
              "id": "k_KwDVf3rGQnwNMZYwr_V",
              "data": {
                "href": "",
                "text": "Qty 1",
                "align": "right",
                "color": "#3f3f46",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 14
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 6,
              "right": 6,
              "bottom": 6
            }
          }
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "padding": {
          "top": 0,
          "left": 36,
          "right": 36,
          "bottom": 0
        },
        "fullWidth": false,
        "stackOnMobile": false,
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "rv9OvT2PzQ_H4H291c87Z",
      "type": "row",
      "columns": [
        {
          "id": "4kVSbzQ2LXut8KffNO-ky",
          "width": 22,
          "blocks": [
            {
              "id": "84vxT1vys72uN89zJCrSA",
              "data": {
                "href": "",
                "text": "Tote",
                "align": "center",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                }
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 0,
              "right": 0,
              "bottom": 6
            },
            "padding": {
              "top": 18,
              "left": 0,
              "right": 0,
              "bottom": 18
            },
            "borderRadius": 8,
            "backgroundColor": "#cecccc"
          }
        },
        {
          "id": "UAQKRbLsMyKdSSUhd8-RK",
          "width": 44,
          "blocks": [
            {
              "id": "rn0JHKCvNvlFBYJcI1_m3",
              "data": {
                "href": "",
                "text": "Canvas tote bag",
                "align": "left",
                "color": "#18181b",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 15,
                "fontWeight": "bold"
              },
              "type": "paragraph"
            },
            {
              "id": "edPOYH98BYgKbdN9WU1Fj",
              "data": {
                "href": "",
                "text": "Natural",
                "align": "left",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 14
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 16,
              "right": 16,
              "bottom": 6
            }
          }
        },
        {
          "id": "kN-2tCNR4s7AjbyErd5Xi",
          "width": 34,
          "blocks": [
            {
              "id": "qcQdfNycYj2XxMiLj1Rkw",
              "data": {
                "href": "",
                "text": "Qty 2",
                "align": "right",
                "color": "#3f3f46",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 14
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 6,
              "right": 6,
              "bottom": 6
            }
          }
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "padding": {
          "top": 0,
          "left": 36,
          "right": 36,
          "bottom": 0
        },
        "fullWidth": false,
        "stackOnMobile": false,
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "1e03ud6RrczVfDoCe_Sxb",
      "type": "row",
      "columns": [
        {
          "id": "MSCSVA9A0J8Zyi6w_nSv0",
          "width": 22,
          "blocks": [
            {
              "id": "xzGrHN0iFFfPAXSiPKDP6",
              "data": {
                "href": "",
                "text": "Socks",
                "align": "center",
                "border": {},
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                }
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 0,
              "right": 0,
              "bottom": 6
            },
            "padding": {
              "top": 18,
              "left": 0,
              "right": 0,
              "bottom": 18
            },
            "borderRadius": 8,
            "backgroundColor": "#cecccc"
          }
        },
        {
          "id": "DmwASe1M3lKE8rl0vgrSu",
          "width": 44,
          "blocks": [
            {
              "id": "cuxEWXUqGnnfm7DD-Uu8Q",
              "data": {
                "href": "",
                "text": "Merino socks, 3-pack",
                "align": "left",
                "color": "#18181b",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 15,
                "fontWeight": "bold"
              },
              "type": "paragraph"
            },
            {
              "id": "7cihC1839_iA17zFodyDo",
              "data": {
                "href": "",
                "text": "Charcoal / 39-42",
                "align": "left",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 14
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 16,
              "right": 16,
              "bottom": 6
            }
          }
        },
        {
          "id": "Aw6kRYY6ppSLGg9ejxY-w",
          "width": 34,
          "blocks": [
            {
              "id": "Q3jmGXA08wzXuOa41ya1f",
              "data": {
                "href": "",
                "text": "Qty 1",
                "align": "right",
                "color": "#3f3f46",
                "border": {},
                "padding": {
                  "top": 0,
                  "left": 0,
                  "right": 0,
                  "bottom": 0
                },
                "fontSize": 14
              },
              "type": "paragraph"
            }
          ],
          "settings": {
            "border": {},
            "margin": {
              "top": 6,
              "left": 6,
              "right": 6,
              "bottom": 6
            }
          }
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "padding": {
          "top": 0,
          "left": 36,
          "right": 36,
          "bottom": 0
        },
        "fullWidth": false,
        "stackOnMobile": false,
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "7DpLReZ_TLRw90b27eAdV",
      "type": "row",
      "columns": [
        {
          "id": "izuP0vKHF9cge3ps-Y4yZ",
          "width": 100,
          "blocks": [
            {
              "id": "p-IjzHnqIWlxNfPgxwVUn",
              "data": {
                "align": "center",
                "color": "#cccccc",
                "width": 100,
                "padding": {
                  "top": 10,
                  "left": 0,
                  "right": 0,
                  "bottom": 10
                },
                "borderStyle": "solid",
                "borderWidth": 1
              },
              "type": "divider"
            },
            {
              "id": "JHMTPoqhj6miRB-1lzBXC",
              "data": {
                "href": "",
                "text": "Not home? DHL Express will leave a notice and try again the next business day. You can also <a href=\"#\">change the delivery</a> on the tracking page.",
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
            }
          ],
          "settings": {}
        }
      ],
      "settings": {
        "align": "center",
        "border": {},
        "padding": {
          "top": 0,
          "left": 36,
          "right": 36,
          "bottom": 36
        },
        "fullWidth": false,
        "borderRadius": {
          "bottom": 12
        },
        "backgroundColor": "#ffffff"
      }
    },
    {
      "id": "9L-KqNKMf0P3rXnquCPja",
      "type": "row",
      "columns": [
        {
          "id": "cUjOHZtkwteVaesczVaPD",
          "width": 100,
          "blocks": [
            {
              "id": "G8SrS0TWPbA-4WebcZmMU",
              "data": {
                "href": "",
                "text": "Questions about your order? Reply to this email or <a href=\"#\">contact support</a>.\nAcme",
                "align": "center",
                "color": "#71717a",
                "border": {},
                "padding": {
                  "top": 10,
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
        "margin": {
          "top": 16,
          "left": 0,
          "right": 0,
          "bottom": 16
        },
        "padding": {
          "top": 0,
          "left": 100,
          "right": 100,
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

export const SHIPPING_UPDATE_TEMPLATE: StarterTemplate = {
  name: "Shipping update",
  subject: "Your order #10482 is on its way",
  preheader: "Arriving Thursday, Oct 15 with DHL Express. Track your package anytime.",
  design,
};
