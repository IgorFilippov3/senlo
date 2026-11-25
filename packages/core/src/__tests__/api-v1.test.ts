import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  clientLabel,
  hasPermission,
  principalFromApiKey,
  requirePermission,
  type ApiPrincipal,
} from "../api-principal";
import { MAX_API_ISSUES, apiIssues, formatIssuePath, parseApiInput } from "../api-issues";
import { PermissionRequiredError, ValidationError } from "../errors";
import { API_V1_OPERATIONS, apiV1OpenApiDocument } from "../api-v1/openapi";
import { ApiErrorSchema, ApiMeSchema } from "../api-v1/schemas";

describe("ApiPrincipal", () => {
  it("gives an API key both permissions until keys carry their own", () => {
    const principal = principalFromApiKey({ id: 3, projectId: 7 }, null);
    expect(principal).toEqual({
      projectId: 7,
      permissions: ["send", "manage"],
      source: "api_key",
      actor: { apiKeyId: 3 },
      client: null,
    });
  });

  it("refuses a missing permission with a 403 that names it", () => {
    const sendOnly: ApiPrincipal = { ...principalFromApiKey({ id: 1, projectId: 1 }, null), permissions: ["send"] };
    expect(hasPermission(sendOnly, "manage")).toBe(false);
    expect(() => requirePermission(sendOnly, "send")).not.toThrow();

    let thrown: unknown;
    try {
      requirePermission(sendOnly, "manage");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PermissionRequiredError);
    expect(thrown).toMatchObject({ code: "PERMISSION_REQUIRED", statusCode: 403, details: { permission: "manage" } });
    expect((thrown as PermissionRequiredError).hint).toContain("manage");
  });

  it("keeps the Senlo-Client header as a short printable label", () => {
    expect(clientLabel(null)).toBeNull();
    expect(clientLabel("   ")).toBeNull();
    expect(clientLabel(" mcp/1.0.0 ")).toBe("mcp/1.0.0");
    expect(clientLabel("mcp\n/1\u0000")).toBe("mcp/1");
    expect(clientLabel("x".repeat(500))).toHaveLength(100);
  });
});

describe("API issues", () => {
  const design = z
    .object({
      rows: z.array(
        z.object({ blocks: z.array(z.object({ props: z.object({ href: z.string().url() }).strict() })) }),
      ),
    })
    .strict();

  it("formats paths with dots and indexes", () => {
    expect(formatIssuePath([])).toBe("");
    expect(formatIssuePath(["design", "rows", 2, "blocks", 0, "props", "href"])).toBe(
      "design.rows[2].blocks[0].props.href",
    );
    expect(formatIssuePath([0, "name"])).toBe("[0].name");
  });

  it("keeps the full path of a nested error", () => {
    const parsed = design.safeParse({ rows: [{ blocks: [{ props: { href: "nope" } }] }] });
    expect(parsed.success).toBe(false);
    expect(apiIssues((parsed as z.SafeParseError<unknown>).error)).toEqual([
      { path: "rows[0].blocks[0].props.href", code: "invalid_string", message: "Invalid url" },
    ]);
  });

  it("reports every unknown key at its own path", () => {
    const parsed = design.safeParse({ rows: [{ blocks: [{ props: { href: "https://a.b", hreff: 1, x: 2 } }] }] });
    expect(apiIssues((parsed as z.SafeParseError<unknown>).error)).toEqual([
      expect.objectContaining({ path: "rows[0].blocks[0].props.hreff", code: "unrecognized_keys" }),
      expect.objectContaining({ path: "rows[0].blocks[0].props.x", code: "unrecognized_keys" }),
    ]);
  });

  it("parseApiInput returns the data or throws a ValidationError with issues and a hint", () => {
    expect(parseApiInput(z.object({ a: z.number() }), { a: 1 })).toEqual({ a: 1 });

    let thrown: unknown;
    try {
      parseApiInput(design, { rows: [{ blocks: [{ props: { href: "nope" } }] }] });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ValidationError);
    const error = thrown as ValidationError;
    expect(error.message).toBe("rows[0].blocks[0].props.href: Invalid url");
    expect(error.details).toEqual({
      issues: [{ path: "rows[0].blocks[0].props.href", code: "invalid_string", message: "Invalid url" }],
      issueCount: 1,
    });
    expect(error.hint).toBeTruthy();
  });

  it("caps the issues and counts the rest", () => {
    const many = z.object({ items: z.array(z.number()) });
    let thrown: ValidationError | undefined;
    try {
      parseApiInput(many, { items: Array.from({ length: 30 }, () => "x") });
    } catch (error) {
      thrown = error as ValidationError;
    }
    expect(thrown?.details?.issues).toHaveLength(MAX_API_ISSUES);
    expect(thrown?.details?.issueCount).toBe(30);
    expect(thrown?.message).toBe("The request has 30 invalid fields.");
  });
});

describe("API v1 OpenAPI document", () => {
  const doc = apiV1OpenApiDocument();

  it("lists every operation", () => {
    for (const op of API_V1_OPERATIONS) {
      const [method, path] = op.split(" ");
      expect(doc.paths?.[path]?.[method.toLowerCase() as "get"], op).toBeDefined();
    }
  });

  it("describes /me with the Me schema and the error shape", () => {
    const me = doc.paths?.["/api/v1/me"]?.get;
    expect(me?.security).toEqual([{ bearerAuth: [] }]);
    expect(JSON.stringify(me?.responses?.["200"])).toContain("#/components/schemas/Me");
    expect(JSON.stringify(me?.responses?.["401"])).toContain("#/components/schemas/ApiError");
    expect(doc.components?.schemas?.Me).toBeDefined();
    expect(doc.components?.securitySchemes?.bearerAuth).toMatchObject({ type: "http", scheme: "bearer" });
  });

  it("is generated once", () => {
    expect(apiV1OpenApiDocument()).toBe(doc);
  });

  it("schemas accept what the routes send", () => {
    expect(
      ApiMeSchema.safeParse({
        project: { id: 1, name: "a" },
        permissions: ["manage"],
        auth: { source: "api_key", apiKey: { id: 1, name: "k", prefix: "snl_abcdefgh" }, client: null },
        instance: { edition: "self-hosted", apiVersion: "v1" },
      }).success,
    ).toBe(true);
    expect(
      ApiErrorSchema.safeParse({ error: { code: "NOT_FOUND", message: "x", requestId: "req_1" } }).success,
    ).toBe(true);
  });
});
