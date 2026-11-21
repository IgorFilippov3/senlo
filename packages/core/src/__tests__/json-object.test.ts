import { describe, it, expect } from "vitest";
import { jsonObjectError } from "../json-object";

describe("jsonObjectError", () => {
  it.each(["", "   ", "{}", '{"name": "Spike"}', '{"a": {"b": [1, 2]}}'])("accepts %j", (text) => {
    expect(jsonObjectError(text)).toBeNull();
  });

  it.each(['{name: "Spike"}', "{bad", '{"a": 1,}'])("reports invalid JSON: %s", (text) => {
    expect(jsonObjectError(text)).toMatch(/Invalid JSON/);
  });

  it.each(["[1]", '"x"', "null", "42", "true"])("reports JSON that is not an object: %s", (text) => {
    expect(jsonObjectError(text)).toMatch(/JSON object/);
  });
});
