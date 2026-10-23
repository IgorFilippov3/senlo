import { describe, it, expect } from "vitest";
import { buildPreviewData, DEFAULT_PREVIEW_DATA } from "../use-preview-data";

describe("buildPreviewData", () => {
  it("uses the editor's sample values when the host passes none", () => {
    expect(buildPreviewData(null)).toEqual({
      contact: {},
      custom: {},
      workspace: { name: DEFAULT_PREVIEW_DATA.workspaceName },
      trigger: { name: DEFAULT_PREVIEW_DATA.triggerName },
      unsubscribeUrl: DEFAULT_PREVIEW_DATA.unsubscribeUrl,
    });
  });

  it("takes the host's values one by one, keeping defaults for the rest", () => {
    const data = buildPreviewData(
      { first_name: "Ann" },
      { workspaceName: "Acme", unsubscribeUrl: "https://mail.acme.test/unsubscribe/x", triggerName: undefined },
    );
    expect(data.workspace.name).toBe("Acme");
    expect(data.unsubscribeUrl).toBe("https://mail.acme.test/unsubscribe/x");
    expect(data.trigger.name).toBe(DEFAULT_PREVIEW_DATA.triggerName);
    expect(data.contact).toEqual({ first_name: "Ann" });
    expect(data.custom).toEqual({ first_name: "Ann" });
  });
});
