import { describe, it, expect } from "vitest";
import type { EmailDesignDocument } from "../emailDesign";
import { replaceMergeTags } from "../merge-tags";
import { renderEmailDesign } from "../renderer/renderEmailDesign";
import { buildStepData } from "../workflow-step-data";

const contact = { email: "ann@x.io", name: "Ann", locale: "en", meta: { first_name: "Ann", plan: "free" } };
const context = {
  event: { name: "order_created", payload: { total: 42, items: [{ title: "Mug" }, { title: "Cap" }] } },
  steps: { n1: { status: 200, body: { plan: "pro" } } },
};

/** What `TriggerService` puts in the send job for `data`. */
const renderData = (data: Record<string, unknown>) => ({ custom: data, contact: { email: contact.email, ...data } });

describe("buildStepData", () => {
  it("has the attributes flat, the contact, the event payload and the step outputs", () => {
    const data = buildStepData(contact, context);
    expect(data).toEqual({
      first_name: "Ann",
      plan: "free",
      contact: { first_name: "Ann", plan: "free", email: "ann@x.io", name: "Ann", locale: "en" },
      event: context.event.payload,
      steps: context.steps,
    });
  });

  it("namespaces win over attributes with the same name, and email cannot be overridden", () => {
    const data = buildStepData({ ...contact, meta: { event: "x", steps: 1, contact: "y", email: "evil@x.io" } }, { steps: {} });
    expect(data.event).toEqual({});
    expect(data.steps).toEqual({});
    expect(data.contact.email).toBe("ann@x.io");
  });

  it("works without meta or event", () => {
    expect(buildStepData({ email: "a@b.c", name: null, locale: null, meta: null }, { steps: {} })).toEqual({
      contact: { email: "a@b.c", name: null, locale: null },
      event: {},
      steps: {},
    });
  });

  it("resolves dotted merge tags: event, steps, contact and flat attributes", () => {
    const text =
      "{{first_name}} / {{contact.first_name}} / {{contact.email}} / {{event.total}} / {{steps.n1.body.plan}} / {{event.missing}}";
    expect(replaceMergeTags(text, renderData(buildStepData(contact, context)))).toBe(
      "Ann / Ann / ann@x.io / 42 / pro / {{event.missing}}",
    );
  });

  it("loops and conditions in a design read the event payload", () => {
    const heading = (id: string, text: string, condition?: object) => ({
      id,
      type: "heading",
      data: { text },
      ...(condition ? { condition } : {}),
    });
    const design = {
      version: 4,
      settings: { contentWidth: 600 },
      rows: [
        {
          id: "lines",
          type: "row",
          loop: { variable: "event.items", alias: "item" },
          settings: {},
          columns: [{ id: "c1", width: 100, blocks: [heading("h1", "Line {{item.title}}")] }],
        },
        {
          id: "big",
          type: "row",
          settings: {},
          columns: [
            {
              id: "c2",
              width: 100,
              blocks: [
                heading("h2", "Big order", { variable: "event.total", operator: "gt", value: "40" }),
                heading("h3", "Small order", { variable: "event.total", operator: "lt", value: "40" }),
              ],
            },
          ],
        },
      ],
    } as unknown as EmailDesignDocument;

    const html = renderEmailDesign(design, { data: renderData(buildStepData(contact, context)) });
    expect(html).toContain("Line Mug");
    expect(html).toContain("Line Cap");
    expect(html).toContain("Big order");
    expect(html).not.toContain("Small order");
  });
});
