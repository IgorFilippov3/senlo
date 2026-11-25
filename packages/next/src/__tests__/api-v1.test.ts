// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  AppError,
  FormValidationError,
  NotFoundError,
  PermissionRequiredError,
  ProviderError,
  RateLimitedError,
  ValidationError,
} from "@senlo/core";
import { ApiErrorSchema } from "@senlo/core/server";
import { DEFAULT_HINTS, v1ErrorBody, v1ErrorResponse } from "../api-v1";

const RID = "req_test";

describe("v1ErrorBody", () => {
  it("passes issues and the error's own hint through", () => {
    const error = new ValidationError(
      "rows[0].href: Invalid url",
      { issues: [{ path: "rows[0].href", code: "invalid_string", message: "Invalid url" }], issueCount: 1 },
      "Fix it.",
    );
    const { status, body } = v1ErrorBody(error, RID);
    expect(status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "rows[0].href: Invalid url",
        hint: "Fix it.",
        issues: [{ path: "rows[0].href", code: "invalid_string", message: "Invalid url" }],
        requestId: RID,
      },
    });
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  });

  it("calls a request with only unknown fields UNKNOWN_FIELD", () => {
    const error = new ValidationError("x", {
      issues: [{ path: "hreff", code: "unrecognized_keys", message: "Unknown field" }],
    });
    expect(v1ErrorBody(error, RID).body.error.code).toBe("UNKNOWN_FIELD");
  });

  it("counts issues beyond the ones shown", () => {
    const issues = Array.from({ length: 20 }, (_, i) => ({ path: `a[${i}]`, code: "invalid_type", message: "x" }));
    const { body } = v1ErrorBody(new ValidationError("many", { issues, issueCount: 35 }), RID);
    expect(body.error.issues).toHaveLength(20);
    expect(body.error.issueCount).toBe(35);
  });

  it("turns a form error from an older service into issues, its first field as the message", () => {
    const error = new FormValidationError({ name: ["Name is required"], general: ["Something else"] });
    const { body } = v1ErrorBody(error, RID);
    expect(body.error.message).toBe("name: Name is required");
    expect(body.error.issues).toEqual([
      { path: "name", code: "custom", message: "Name is required" },
      { path: "", code: "custom", message: "Something else" },
    ]);
    expect(body.error.details).toBeUndefined();
  });

  it("maps codes and fills in the default hint", () => {
    expect(v1ErrorBody(new NotFoundError("Template", 5), RID)).toMatchObject({
      status: 404,
      body: { error: { code: "NOT_FOUND", hint: DEFAULT_HINTS.NOT_FOUND, details: { resource: "Template" } } },
    });
    expect(v1ErrorBody(new ProviderError("Domain not verified"), RID).body.error.code).toBe("PROVIDER_ERROR");
    expect(v1ErrorBody(new AppError("DUPLICATE_ENTRY", "exists"), RID).body.error.code).toBe("CONFLICT");
    expect(v1ErrorBody(new PermissionRequiredError("manage"), RID).body.error.code).toBe("PERMISSION_REQUIRED");
  });

  it("never shows internals", () => {
    for (const error of [
      new Error("password=hunter2"),
      new AppError("DATABASE_ERROR", "relation users does not exist"),
      new AppError("UNKNOWN_ERROR", "boom", { originalError: "stack" }),
      "a string",
    ]) {
      const { status, body } = v1ErrorBody(error, RID);
      expect(status).toBe(500);
      expect(body.error).toEqual({
        code: "INTERNAL_ERROR",
        message: "Something failed on Senlo's side.",
        hint: DEFAULT_HINTS.INTERNAL_ERROR,
        requestId: RID,
      });
    }
  });

  it("drops originalError from the details of a client error", () => {
    const { body } = v1ErrorBody(new ValidationError("bad", { originalError: "stack", reasons: ["no trigger"] }), RID);
    expect(body.error.details).toEqual({ reasons: ["no trigger"] });
  });
});

describe("v1ErrorResponse", () => {
  it("sets X-Request-Id, and Retry-After on a rate limit", async () => {
    const response = v1ErrorResponse(new RateLimitedError(30), RID);
    expect(response.status).toBe(429);
    expect(response.headers.get("X-Request-Id")).toBe(RID);
    expect(response.headers.get("Retry-After")).toBe("30");
  });
});
