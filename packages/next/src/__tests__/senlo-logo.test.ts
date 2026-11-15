// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SENLO_LOGO_RATIO, SenloLogo } from "@senlo/ui";

const render = (props: Parameters<typeof SenloLogo>[0] = {}) => renderToStaticMarkup(createElement(SenloLogo, props));

describe("SenloLogo", () => {
  it("is outlines, not text: it does not depend on the font being loaded", () => {
    const html = render();
    expect(html).not.toContain("<text");
    expect(html.match(/<path /g)).toHaveLength(2);
  });

  it("the word takes the text colour, the full stop the accent", () => {
    const html = render();
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('fill="var(--sl-color-accent, #a9441f)"');
    expect(render({ dotColor: "#e39a78" })).toContain('fill="#e39a78"');
  });

  it("is sized by the font size, like the text it replaced", () => {
    expect(render()).toContain("height:0.707em");
  });

  it("is named for screen readers, unless told it sits next to the name", () => {
    expect(render()).toContain('aria-label="Senlo"');
    const silent = render({ title: "" });
    expect(silent).toContain('aria-hidden="true"');
    expect(silent).not.toContain("aria-label");
  });

  it("states its proportions for places that need both sides", () => {
    expect(render()).toContain('viewBox="0 0 2437 707"');
    expect(SENLO_LOGO_RATIO).toBeCloseTo(2437 / 707, 5);
  });
});
