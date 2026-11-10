import { describe, it, expect } from "vitest";
import { isSystemEvent, isValidEventName, triggerMatches } from "../workflow-events";

describe("workflow events", () => {
  it("knows the system events", () => {
    expect(["contact_added", "contact_updated", "tag_added"].every(isSystemEvent)).toBe(true);
    expect(isSystemEvent("order_created")).toBe(false);
  });

  it("validates names", () => {
    expect(isValidEventName("payment.failed")).toBe(true);
    expect(isValidEventName("x".repeat(64))).toBe(true);
    expect(isValidEventName("x".repeat(65))).toBe(false);
    expect(isValidEventName("Payment")).toBe(false);
    expect(isValidEventName("-x")).toBe(false);
  });

  it("matches a trigger by name, and by tag for tag_added", () => {
    expect(triggerMatches({ event: "a" }, { name: "a", payload: {} })).toBe(true);
    expect(triggerMatches({ event: "a" }, { name: "b", payload: {} })).toBe(false);
    expect(triggerMatches({ event: "tag_added", tag: "vip" }, { name: "tag_added", payload: { tags: ["vip"] } })).toBe(true);
    expect(triggerMatches({ event: "tag_added", tag: "vip" }, { name: "tag_added", payload: {} })).toBe(false);
    // A tag on another trigger type means nothing.
    expect(triggerMatches({ event: "a", tag: "vip" }, { name: "a", payload: {} })).toBe(true);
  });
});
