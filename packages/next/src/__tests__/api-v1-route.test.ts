// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { IdempotencyKeyReusedError, NotFoundError } from "@senlo/core";
import type { SenloHost } from "../host";
import type { SenloRateLimit } from "../rate-limit";
import { createV1Route } from "../api-v1-route";

const principal = {
  projectId: 7,
  permissions: ["manage"],
  source: "api_key",
  actor: { apiKeyId: 1 },
  client: null,
};

function setup() {
  const idempotency = {
    begin: vi.fn(async () => ({ run: true as const, id: 11 })),
    complete: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
  };
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const host: SenloHost = {
    getServices: () =>
      ({
        auth: { resolvePrincipal: vi.fn(async (t: string) => (t === "snl_good" ? principal : null)) },
        idempotency,
      }) as never,
    requireUserId: async () => "u1",
    currentUserId: async () => "u1",
    getConfig: () => ({ appUrl: "http://localhost:3000", defaultFromEmail: "hello@senlo.io" }),
    logger,
    rateLimit: { limitRequest: vi.fn(async () => null) } as unknown as SenloRateLimit,
  };
  return { route: createV1Route(host), idempotency, logger };
}

const request = (body: string | undefined, headers: Record<string, string> = {}, method = "POST") =>
  new NextRequest("http://localhost/api/v1/things", {
    method,
    headers: { Authorization: "Bearer snl_good", "content-type": "application/json", ...headers },
    body,
  });

describe("createV1Route", () => {
  it("hands run the parsed body and answers 201 with { data }", async () => {
    const { route } = setup();
    const run = vi.fn(async ({ body }: { body: unknown }) => ({ data: { echo: body }, status: 201 }));
    const response = await route("createThing", { permission: "manage" }, run)(request('{"a":1}'));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { echo: { a: 1 } } });
  });

  it("refuses a body that is not JSON", async () => {
    const { route } = setup();
    const run = vi.fn();
    const response = await route("createThing", { permission: "manage" }, run)(request("{nope"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatchObject({ code: "VALIDATION_ERROR", message: "The request body is not valid JSON." });
    expect(run).not.toHaveBeenCalled();
  });

  it("passes no body for GET or an empty POST", async () => {
    const { route } = setup();
    const run = vi.fn(async ({ body }: { body: unknown }) => ({ data: body ?? null }));
    await route("t", { permission: "manage" }, run)(request(undefined, {}, "GET"));
    await route("t", { permission: "manage" }, run)(request("  "));
    expect(run.mock.calls.map((c) => c[0].body)).toEqual([undefined, undefined]);
  });

  describe("Idempotency-Key", () => {
    it("is ignored on a route that does not take it", async () => {
      const { route, idempotency } = setup();
      await route("t", { permission: "manage" }, async () => ({ data: 1 }))(request("{}", { "Idempotency-Key": "k" }));
      expect(idempotency.begin).not.toHaveBeenCalled();
    });

    it("claims the key with the method, path and body, and keeps a successful answer", async () => {
      const { route, idempotency } = setup();
      const response = await route("t", { permission: "manage", idempotent: true }, async () => ({
        data: { id: 5 },
        status: 201,
      }))(request('{"a":1}', { "Idempotency-Key": "k1" }));

      expect(response.status).toBe(201);
      expect(idempotency.begin).toHaveBeenCalledWith(7, "k1", "POST /api/v1/things", { a: 1 });
      expect(idempotency.complete).toHaveBeenCalledWith(11, 201, { data: { id: 5 } });
      expect(idempotency.release).not.toHaveBeenCalled();
    });

    it("replays the first answer without running", async () => {
      const { route, idempotency } = setup();
      idempotency.begin.mockResolvedValueOnce({ run: false, status: 201, body: { data: { id: 5 } } } as never);
      const run = vi.fn();
      const response = await route("t", { permission: "manage", idempotent: true }, run)(
        request("{}", { "Idempotency-Key": "k1" }),
      );

      expect(response.status).toBe(201);
      expect(response.headers.get("Idempotent-Replayed")).toBe("true");
      expect(response.headers.get("X-Request-Id")).toMatch(/^req_/);
      expect(await response.json()).toEqual({ data: { id: 5 } });
      expect(run).not.toHaveBeenCalled();
    });

    it("frees the key when the request fails, so a corrected retry runs", async () => {
      const { route, idempotency } = setup();
      const response = await route("t", { permission: "manage", idempotent: true }, async () => {
        throw new NotFoundError("Template", 3);
      })(request("{}", { "Idempotency-Key": "k1" }));

      expect(response.status).toBe(404);
      expect(idempotency.release).toHaveBeenCalledWith(11);
      expect(idempotency.complete).not.toHaveBeenCalled();
    });

    it("answers a reused key with 409", async () => {
      const { route, idempotency } = setup();
      idempotency.begin.mockRejectedValueOnce(new IdempotencyKeyReusedError());
      const response = await route("t", { permission: "manage", idempotent: true }, vi.fn())(
        request("{}", { "Idempotency-Key": "k1" }),
      );
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
      expect(idempotency.release).not.toHaveBeenCalled();
    });
  });
});
