// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FormValidationError,
  ForbiddenError,
  NotFoundError,
  QuotaExceededError,
  ValidationError,
} from "@senlo/core";
import { errorResponse, validateId, withErrorHandling, withFormErrors } from "../errors";

afterEach(() => vi.restoreAllMocks());
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("errorResponse", () => {
  it("answers an AppError with its own status and message", async () => {
    const notFound = errorResponse(new NotFoundError("Project"));
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toMatchObject({ error: "Project not found" });

    expect(errorResponse(new ForbiddenError("project")).status).toBe(403);
    expect(errorResponse(new QuotaExceededError("Monthly limit reached")).status).toBe(402);
  });

  it("answers a form error with its first field message", async () => {
    const response = errorResponse(
      new FormValidationError({ email: ["Invalid email"] }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid email" });
  });

  it("answers anything else with a 500 and the fallback, never the error's text", async () => {
    const response = errorResponse(new Error("password authentication failed for user"), "Failed");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed" });
  });
});

describe("withErrorHandling", () => {
  it("wraps a result", async () => {
    expect(await withErrorHandling(async () => 42)).toEqual({ success: true, data: 42 });
  });

  it("returns an AppError as itself and a plain error as UNKNOWN_ERROR", async () => {
    quiet();
    const known = await withErrorHandling(async () => {
      throw new NotFoundError("Template");
    });
    expect(known).toMatchObject({ success: false, error: { code: "NOT_FOUND", message: "Template not found" } });

    const unknown = await withErrorHandling(async () => {
      throw new Error("Pick a provider first");
    });
    expect(unknown).toMatchObject({
      success: false,
      error: { code: "UNKNOWN_ERROR", message: "Pick a provider first" },
    });
  });
});

describe("withFormErrors", () => {
  it("keeps a FormValidationError's fields", async () => {
    const result = await withFormErrors(async () => {
      throw new FormValidationError({ name: ["Required"] }, ["Bad"]);
    });
    expect(result).toEqual({ error: { formErrors: ["Bad"], fieldErrors: { name: ["Required"] } } });
  });

  it("puts any other failure under general", async () => {
    quiet();
    const result = await withFormErrors(async () => {
      throw new Error("Something broke");
    });
    expect(result).toEqual({ error: { formErrors: [], fieldErrors: { general: ["Something broke"] } } });
  });
});

describe("validateId", () => {
  it("accepts a positive number and refuses the rest", () => {
    expect(validateId("12")).toBe(12);
    expect(() => validateId("0")).toThrow(ValidationError);
    expect(() => validateId("abc", "templateId")).toThrow("Invalid templateId");
  });
});
