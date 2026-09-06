import { describe, it, expect } from "vitest";
import { replaceMergeTags } from "../merge-tags";

const contact = { first_name: "Ann", email: "ann@example.com" };

describe("replaceMergeTags", () => {
  it("substitutes values from the contact context", () => {
    expect(replaceMergeTags("Hi {{contact.first_name}}!", { contact })).toBe(
      "Hi Ann!",
    );
  });

  it("escapes markup coming from recipient data", () => {
    const hostile = { first_name: '<img src=x onerror="alert(1)">' };
    const out = replaceMergeTags("<p>{{contact.first_name}}</p>", {
      contact: hostile,
    });

    expect(out).toBe(
      "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>",
    );
    expect(out).not.toContain("<img");
  });

  it("escapes quotes so a value cannot break out of an attribute", () => {
    const out = replaceMergeTags('<a href="{{contact.url}}">x</a>', {
      contact: { url: '" onmouseover="alert(1)' },
    });

    expect(out).not.toContain('" onmouseover=');
    expect(out).toContain("&quot;");
  });

  it("does not let a value be expanded again on a second pass", () => {
    const once = replaceMergeTags("{{contact.first_name}}", {
      contact: { first_name: "{{contact.email}}" },
    });
    const twice = replaceMergeTags(once, { contact });

    expect(twice).not.toContain("ann@example.com");
  });

  it("leaves the tag in place when the variable is missing", () => {
    expect(replaceMergeTags("Hi {{contact.nickname}}", { contact })).toBe(
      "Hi {{contact.nickname}}",
    );
  });

  it("does not stringify objects into the document", () => {
    expect(
      replaceMergeTags("{{contact.meta}}", {
        contact: { meta: { plan: "pro" } },
      }),
    ).toBe("{{contact.meta}}");
  });

  it("does not resolve inherited properties", () => {
    const out = replaceMergeTags("{{contact.constructor}}", { contact });
    expect(out).toBe("{{contact.constructor}}");
    expect(out).not.toContain("function");
  });

  it("resolves the unsubscribe tag and falls back when it is missing", () => {
    expect(
      replaceMergeTags("{{unsubscribe_url}}", {
        unsubscribeUrl: "https://senlo.io/unsubscribe/abc",
      }),
    ).toBe("https://senlo.io/unsubscribe/abc");

    expect(replaceMergeTags("{{unsubscribe_url}}", {})).toBe(
      "[[Unsubscribe Link]]",
    );
  });

  it("skips escaping for plain text, such as a subject line", () => {
    expect(
      replaceMergeTags(
        "Order for {{contact.company}}",
        { contact: { company: "Smith & Sons" } },
        undefined,
        { escape: false },
      ),
    ).toBe("Order for Smith & Sons");
  });

  it("resolves loop-local data first", () => {
    expect(
      replaceMergeTags("{{item.title}}", { contact }, { item: { title: "Mug" } }),
    ).toBe("Mug");
  });
});
