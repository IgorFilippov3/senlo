// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { FormValidationError, NotFoundError, UnauthorizedError } from "@senlo/core";
import { SENLO_ACTION_METHODS, createClientActions } from "@senlo/features";
import { dispatchPublicAction, dispatchSenloAction } from "../actions";
import type { SenloHost } from "../host";
import type { SenloRateLimit } from "../rate-limit";

afterEach(() => vi.restoreAllMocks());

function fakeHost(services: Record<string, unknown> = {}, overrides: Partial<SenloHost> = {}) {
  const onMutated = vi.fn();
  const rateLimit = { limitAction: vi.fn(async () => {}) } as unknown as SenloRateLimit;
  const host: SenloHost = {
    getServices: () => services as never,
    requireUserId: async () => "u1",
    currentUserId: async () => "u1",
    getConfig: () => ({ appUrl: "http://localhost:3000", defaultFromEmail: "hello@senlo.io" }),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    rateLimit,
    onMutated,
    ...overrides,
  };
  return { host, onMutated, rateLimit };
}

const signedOut = {
  requireUserId: async () => {
    throw new UnauthorizedError();
  },
  currentUserId: async () => null,
};

const allNames = Object.entries(SENLO_ACTION_METHODS).flatMap(([group, methods]) =>
  methods.map((method) => `${group}.${method}`),
);

describe("dispatchSenloAction", () => {
  it("has a handler for every SenloActions method, and each checks the session", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { host } = fakeHost({}, signedOut);

    for (const name of allNames) {
      const result = (await dispatchSenloAction(host, name, [1, {}, {}])) as Record<string, unknown>;
      // A form action reports under `general`, any other under `error.code`.
      const text = JSON.stringify(result);
      expect(text, name).not.toContain("Unknown action");
      expect(result.success, name).not.toBe(true);
    }
  });

  it("refuses an unknown name, a prototype key and arguments that are not a list", async () => {
    const { host } = fakeHost();
    for (const [name, args] of [
      ["templates.nope", []],
      ["__proto__", []],
      ["constructor", []],
      ["templates.list", "7"],
      [42, []],
    ] as const) {
      expect(await dispatchSenloAction(host, name, args)).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Unknown action" },
      });
    }
  });

  it("calls the service as the signed-in user and returns its data", async () => {
    const create = vi.fn(async () => ({ id: 3, name: "Welcome" }));
    const { host } = fakeHost({ template: { create } });

    const result = await dispatchSenloAction(host, "templates.create", ["7", { name: "Welcome" }]);

    expect(result).toEqual({ success: true, data: { id: 3, name: "Welcome" } });
    expect(create).toHaveBeenCalledWith("u1", 7, { name: "Welcome" });
  });

  it("keeps a form error's fields", async () => {
    const create = vi.fn(async () => {
      throw FormValidationError.field("name", "Required");
    });
    const { host } = fakeHost({ project: { create } });

    expect(await dispatchSenloAction(host, "workspaces.create", [{}])).toEqual({
      error: { formErrors: [], fieldErrors: { name: ["Required"] } },
    });
  });

  it("refreshes after a successful change only", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const services = {
      template: { listProjectTemplates: vi.fn(async () => []), delete: vi.fn(async () => {}) },
      workflow: { saveGraph: vi.fn(async () => {}), delete: vi.fn(async () => { throw new NotFoundError("Workflow"); }) },
    };
    const { host, onMutated } = fakeHost(services);

    await dispatchSenloAction(host, "templates.list", [1]);
    expect(onMutated).not.toHaveBeenCalled();

    await dispatchSenloAction(host, "templates.delete", [1, 2]);
    expect(onMutated).toHaveBeenCalledWith("templates.delete");

    onMutated.mockClear();
    await dispatchSenloAction(host, "workflows.delete", [9]);
    await dispatchSenloAction(host, "workflows.saveGraph", [9, { nodes: [], edges: [] }]);
    expect(onMutated).not.toHaveBeenCalled();
  });

  it("keeps the editor's result shapes", async () => {
    const saveFromEditor = vi.fn(async () => {
      throw new Error("relation \"templates\" does not exist");
    });
    const { host } = fakeHost({ template: { saveFromEditor } });

    expect(await dispatchSenloAction(host, "editor.save", [1, { rows: [] }, "<p/>"])).toEqual({
      success: false,
      error: "Could not save the template. Please try again.",
    });

    const out = fakeHost({}, signedOut);
    expect(await dispatchSenloAction(out.host, "editor.listSavedRows", [])).toEqual([]);
  });
});

describe("dispatchPublicAction", () => {
  const unsubscribe = (result: unknown) =>
    fakeHost({ unsubscribe: { process: vi.fn(async () => result) } }, signedOut);

  it("needs no session and is limited per link", async () => {
    const { host, rateLimit } = unsubscribe({ ok: true });
    expect(await dispatchPublicAction(host, "unsubscribe.process", ["tok"])).toEqual({ success: true, data: {} });
    expect(rateLimit.limitAction).toHaveBeenCalledWith("unsubscribe", "token:tok");
  });

  it("maps the outcomes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dispatchPublicAction(unsubscribe({ ok: false, reason: "confirm_email" }).host, "unsubscribe.process", ["t"]))
      .toEqual({ success: true, data: { needsEmail: true } });
    expect(await dispatchPublicAction(unsubscribe({ ok: false, reason: "invalid" }).host, "unsubscribe.process", ["t"]))
      .toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(
      await dispatchPublicAction(unsubscribe({ ok: false, reason: "not_found" }).host, "unsubscribe.process", ["t", "a@b.c"]),
    ).toMatchObject({ success: false, error: { code: "NOT_FOUND", message: "That address does not match this link." } });
  });

  it("does not reach the signed-in actions", async () => {
    const { host } = fakeHost();
    expect(await dispatchPublicAction(host, "templates.list", [1])).toMatchObject({
      error: { message: "Unknown action" },
    });
  });
});

describe("createClientActions", () => {
  it("sends every method as group.method with its arguments", async () => {
    const call = vi.fn(async () => ({ success: true, data: null }));
    const actions = createClientActions(call);

    await actions.templates.delete(1, 2);
    await actions.dashboard.get(7, { days: 7, eventLimit: 10 });

    expect(call).toHaveBeenCalledWith("templates.delete", [1, 2]);
    expect(call).toHaveBeenCalledWith("dashboard.get", [7, { days: 7, eventLimit: 10 }]);
    for (const name of allNames) {
      const [group, method] = name.split(".");
      expect(typeof (actions as unknown as Record<string, Record<string, unknown>>)[group][method], name).toBe("function");
    }
  });
});
