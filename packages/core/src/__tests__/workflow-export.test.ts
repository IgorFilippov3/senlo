import { describe, expect, it } from "vitest";
import { exportEmailRefs, exportSecretHeaders, instantiateWorkflowExport, parseWorkflowExport } from "../workflow-export";

const exp = {
  format: "senlo.workflow",
  version: 1,
  name: "W",
  settings: {},
  nodes: [
    { id: "a", type: "action", data: { emailRef: "Welcome" } },
    { id: "b", type: "action", data: { emailRef: "Welcome" } },
    { id: "h", type: "http_request", data: { url: "https://x.io", headers: [{ name: "A", value: "leak" }] } },
  ],
  edges: [{ id: "e", source: "a", target: "b" }],
};

describe("workflow export", () => {
  it("parses a file and says why it cannot", () => {
    const ok = parseWorkflowExport(exp);
    expect(ok.success && ok.data.edges[0].sourceHandle).toBeNull();
    expect(parseWorkflowExport({ ...exp, version: 2 })).toEqual({
      success: false,
      error: "Unsupported export version (this Senlo reads version 1) (version)",
    });
    expect(parseWorkflowExport("nope")).toMatchObject({ success: false });
  });

  it("lists the emails to map and the headers to enter again", () => {
    const parsed = parseWorkflowExport(exp);
    if (!parsed.success) throw new Error(parsed.error);
    expect(exportEmailRefs(parsed.data)).toEqual(["Welcome"]);
    expect(exportSecretHeaders(parsed.data)).toEqual([{ nodeId: "h", name: "A" }]);
  });

  it("instantiates with fresh ids and drops header values", () => {
    let n = 0;
    const graph = instantiateWorkflowExport(exp as never, new Map([["Welcome", 7]]), () => `n${++n}`);
    expect(graph.nodes.map((x) => x.id)).toEqual(["n1", "n2", "n3"]);
    expect(graph.nodes[0].data).toEqual({ triggerId: "7" });
    expect(graph.nodes[2].data.headers).toEqual([{ name: "A" }]);
    expect(graph.edges).toEqual([{ id: "n4", source: "n1", target: "n2", sourceHandle: undefined }]);
  });
});
