import { describe, expect, it } from "vitest";
import { sendingSetupOf } from "../sending-setup";

describe("sendingSetupOf", () => {
  it("is ready when the workspace has a provider", () => {
    expect(sendingSetupOf({ providerId: 3 }, 1)).toBe("ready");
  });

  it("asks to add a provider when the account has none", () => {
    expect(sendingSetupOf({ providerId: null }, 0)).toBe("no-providers");
    expect(sendingSetupOf({}, 0)).toBe("no-providers");
  });

  it("asks to select one when providers exist but none is selected", () => {
    expect(sendingSetupOf({ providerId: null }, 2)).toBe("not-selected");
  });
});
