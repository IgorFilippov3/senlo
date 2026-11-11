import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkflowEdge, WorkflowNode, WorkflowVersion } from "../domain";
import type { Logger } from "../logger";
import { RetryableStepError } from "../errors";
import { AutomationService, fillJsonTemplate, readLimitedBody } from "../services/automationService";
import { HTTP_RESPONSE_BODY_LIMIT, validateHttpStep } from "../workflow-http";
import { validateWorkflowGraph } from "../workflow-graph";
import { fakeExecutions } from "./fakes/executions";

const quiet = (): Logger => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
type Node = Omit<WorkflowNode, "workflowId">;
const edge = (from: string, to: string): Omit<WorkflowEdge, "workflowId"> => ({
  id: `${from}-${to}`,
  sourceNodeId: from,
  targetNodeId: to,
  sourceHandle: null,
});

/** trigger → http → exit, in workflow 10 of project 1, contact 3. */
function setup(http: Record<string, unknown>) {
  const nodes: Node[] = [
    { id: "t", type: "trigger", data: { event: "order_created" } },
    { id: "http", type: "http_request", data: http },
    { id: "end", type: "exit", data: {} },
  ];
  const version: WorkflowVersion = {
    id: 1,
    workflowId: 10,
    version: 1,
    graph: { nodes, edges: [edge("t", "http"), edge("http", "end")] },
    settings: {},
    createdAt: new Date(),
  };
  const { repo: executions, runs, steps } = fakeExecutions();
  const openSecret = vi.fn(async (token: string) => (token.startsWith("sealed:") ? token.slice(7) : null));
  const service = new AutomationService(
    {
      findById: async () => ({ id: 10, projectId: 1, status: "ACTIVE", activeVersionId: 1 }),
      getVersion: async () => version,
      openSecret,
    } as never,
    executions,
    { findById: async () => ({ id: 3, email: "ann@x.io", name: "Ann", locale: null, meta: { plan: "pro" } }) } as never,
    { record: vi.fn(), existsSince: vi.fn(), listSince: vi.fn() } as never,
    { add: vi.fn(async () => ({})) } as never,
    { sendTriggeredEmail: vi.fn() } as never,
    quiet(),
  );
  const start = () =>
    service.triggerWorkflow({
      workflowId: 10,
      contactId: 3,
      projectId: 1,
      event: { name: "order_created", payload: { total: 42, id: "o-1" } },
    });
  return { service, runs, steps, openSecret, start };
}

afterEach(() => vi.unstubAllGlobals());

describe("HTTP request step", () => {
  it("sends the opened headers and the filled JSON body; the answer is the step's output", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ ok: true, plan: "pro" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { service, runs, steps, start } = setup({
      method: "POST",
      url: "https://hooks.example.com/orders",
      headers: [{ name: "Authorization", sealed: "sealed:Bearer s3cret" }],
      body: '{"email": "{{contact.email}}", "total": {{event.total}}, "note": "order {{event.id}}"}',
    });
    await start();
    await service.processStep(1, "http", "https://app.test");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/orders");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer s3cret", "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ email: "ann@x.io", total: 42, note: "order o-1" });

    expect(runs.get(1)!.context.steps.http).toEqual({ status: 201, body: { ok: true, plan: "pro" } });
    expect(runs.get(1)).toMatchObject({ currentNodeId: "end" });
    expect(steps.get("1:http")).toMatchObject({ status: "COMPLETED", result: { status: 201 } });
  });

  it("a 4xx fails the step (its onError decides); the answer is still kept", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "nope" }, { status: 422 })));
    const { service, runs, start } = setup({ url: "https://hooks.example.com/x", onError: "continue" });
    await start();
    await service.processStep(1, "http", "https://app.test");
    expect(runs.get(1)!.context.steps.http).toEqual({ status: 422, body: { error: "nope" } });
    expect(runs.get(1)).toMatchObject({ status: "RUNNING", currentNodeId: "end" });
  });

  it("a 5xx is retried while attempts remain", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const { service, runs, start } = setup({ url: "https://hooks.example.com/x" });
    await start();
    await expect(
      service.processStep(1, "http", "https://app.test", { attemptsMade: 0, attempts: 3 }),
    ).rejects.toBeInstanceOf(RetryableStepError);
    expect(runs.get(1)).toMatchObject({ status: "RUNNING", currentNodeId: "http" });
  });

  it("a redelivered job does not send the request again", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { service, runs, steps, start } = setup({ url: "https://hooks.example.com/x" });
    await start();
    await service.processStep(1, "http", "https://app.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Same step row, PENDING again with the answer on it: no second request.
    runs.set(1, { ...runs.get(1)!, status: "RUNNING", currentNodeId: "http", completedAt: null });
    steps.set("1:http", { ...steps.get("1:http")!, status: "PENDING", result: { response: { status: 200, body: { ok: true } } } });
    await service.processStep(1, "http", "https://app.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a header that cannot be decrypted fails the step with a clear message", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { service, runs, steps, start } = setup({
      url: "https://hooks.example.com/x",
      headers: [{ name: "X-Key", sealed: "from-another-key" }],
    });
    await start();
    await service.processStep(1, "http", "https://app.test");
    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
    expect(steps.get("1:http")!.result!.error).toContain('header "X-Key" cannot be decrypted');
  });

  it("GET sends no body", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { service, runs, start } = setup({ method: "GET", url: "https://hooks.example.com/x", body: '{"a": 1}' });
    await start();
    await service.processStep(1, "http", "https://app.test");
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(runs.get(1)!.context.steps.http).toEqual({ status: 204, body: null });
  });
});

describe("API condition output", () => {
  it("keeps the endpoint's answer as the step's output", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ score: 7 })));
    const nodes: Node[] = [
      { id: "t", type: "trigger", data: { event: "x" } },
      { id: "c", type: "condition", data: { mode: "api", url: "https://hooks.example.com/check" } },
    ];
    const { repo: executions, runs } = fakeExecutions();
    const version: WorkflowVersion = { id: 1, workflowId: 10, version: 1, graph: { nodes, edges: [edge("t", "c")] }, settings: {}, createdAt: new Date() };
    const service = new AutomationService(
      { findById: async () => ({ id: 10, projectId: 1, status: "ACTIVE", activeVersionId: 1 }), getVersion: async () => version } as never,
      executions,
      { findById: async () => ({ id: 3, email: "a@b.co", meta: {} }) } as never,
      { record: vi.fn(), existsSince: vi.fn(), listSince: vi.fn() } as never,
      { add: vi.fn(async () => ({})) } as never,
      {} as never,
      quiet(),
    );
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "c", "https://app.test");
    expect(runs.get(1)!.context.steps.c).toEqual({ status: 200, body: { score: 7 } });
  });
});

describe("helpers", () => {
  it("fills merge tags as JSON values outside strings and as text inside", () => {
    const data = { contact: { email: 'a"b@x.io' }, event: { total: 42, items: [1, 2] }, steps: {} };
    const out = fillJsonTemplate(
      '{"to": "{{contact.email}}", "total": {{event.total}}, "items": {{event.items}}, "missing": {{event.nope}}, "esc": "a\\"b {{event.total}}"}',
      data,
    );
    expect(JSON.parse(out)).toEqual({ to: 'a"b@x.io', total: 42, items: [1, 2], missing: null, esc: 'a"b 42' });
  });

  it("cuts a long body and flags it", async () => {
    const long = "x".repeat(HTTP_RESPONSE_BODY_LIMIT + 10);
    const read = await readLimitedBody(new Response(long));
    expect(read.truncated).toBe(true);
    expect((read.body as string).length).toBe(HTTP_RESPONSE_BODY_LIMIT);
    expect(await readLimitedBody(new Response("plain"))).toEqual({ body: "plain" });
  });

  it("validates the step's data", () => {
    expect(validateHttpStep({ url: "https://x.io" })).toEqual([]);
    expect(validateHttpStep({})).toEqual(["An HTTP request has no URL."]);
    expect(validateHttpStep({ url: "ftp://x.io" })).toEqual(["An HTTP request URL must start with http:// or https://."]);
    expect(validateHttpStep({ url: "https://x.io", method: "TRACE", timeoutSeconds: 99, headers: [{ name: "bad name", value: "v" }] })).toEqual([
      "An HTTP request has an unknown method.",
      "An HTTP request header has an invalid name.",
      "An HTTP request timeout must be 1 to 30 seconds.",
    ]);
    expect(validateHttpStep({ url: "https://x.io", headers: [{ name: "X-Key" }] })).toEqual([
      'HTTP request header "X-Key" has no value; enter it again.',
    ]);
    const graph = validateWorkflowGraph(
      [
        { id: "t", type: "trigger", data: { event: "x" } },
        { id: "h", type: "http_request", data: {} },
      ],
      [{ source: "t", target: "h" }],
    );
    expect(graph).toEqual({ valid: false, reasons: ["An HTTP request has no URL."] });
  });
});
