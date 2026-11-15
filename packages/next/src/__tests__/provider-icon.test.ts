// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMAIL_PROVIDER_OPTIONS } from "@senlo/features";
import { ProviderIcon, providerMonogram } from "@senlo/ui";

const render = (props: Parameters<typeof ProviderIcon>[0]) => renderToStaticMarkup(createElement(ProviderIcon, props));

describe("ProviderIcon", () => {
  it("every provider offered in the form has its own letters, SMTP aside", () => {
    const branded = EMAIL_PROVIDER_OPTIONS.filter((option) => option.type !== "SMTP");
    const letters = branded.map((option) => providerMonogram(option.type));
    expect(letters.every((value) => value.length >= 1 && value.length <= 3)).toBe(true);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it("an unknown type still gets letters: the first two of its name", () => {
    expect(providerMonogram("sparkpost")).toBe("SP");
    expect(providerMonogram("x-mailer")).toBe("XM");
  });

  it("renders the monogram, whatever the case of the type", () => {
    const html = render({ type: "ses" });
    expect(html).toContain('data-provider="SES"');
    expect(html).toContain(">SES<");
  });

  it("SMTP is a glyph, not letters: it is a protocol, not a brand", () => {
    const html = render({ type: "SMTP" });
    expect(html).toContain("<svg");
    expect(html).not.toContain(">SM<");
  });

  it("is decorative and takes the size it is given", () => {
    const html = render({ type: "RESEND", size: 32 });
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("width:32px");
    expect(html).toContain("height:32px");
  });
});
