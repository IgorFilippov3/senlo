import { describe, it, expect } from "vitest";
import { ADDABLE_TYPES, STEP_META } from "./stepMeta";
import { INSERTABLE_TYPES } from "../../store/graphOps";

describe("HTTP request step card", () => {
  const summary = (data: Record<string, unknown>) => STEP_META.http_request.summary(data, { triggers: [] });

  it("shows the method and where it calls", () => {
    expect(summary({ method: "PUT", url: "https://api.example.com/hooks/senlo" })).toEqual({
      text: "PUT api.example.com/hooks/senlo",
    });
    expect(summary({ url: "https://api.example.com/" })).toEqual({ text: "POST api.example.com" });
    expect(summary({ url: "" })).toEqual({ text: "Set the URL to call", incomplete: true });
    expect(summary({ url: "https://x.io", label: "Notify CRM" })).toEqual({ text: "Notify CRM" });
  });

  it("can be added and inserted", () => {
    expect(ADDABLE_TYPES).toContain("http_request");
    expect(INSERTABLE_TYPES).toContain("http_request");
  });
});
