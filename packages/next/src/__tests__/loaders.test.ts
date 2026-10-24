// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@senlo/core";
import type { SenloHost } from "../host";
import { loadEditorPage, loadTriggerPage, loadWorkflowPage } from "../loaders";

const { NotFoundSignal } = vi.hoisted(() => ({ NotFoundSignal: class NotFoundSignal extends Error {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundSignal("NEXT_NOT_FOUND");
  },
}));

function fakeHost(services: Record<string, unknown>, overrides: Partial<SenloHost> = {}): SenloHost {
  return {
    getServices: () => services as never,
    requireUserId: async () => "u1",
    currentUserId: async () => "u1",
    getConfig: () => ({ appUrl: "https://app.example", defaultFromEmail: "hi@example.com" }),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    rateLimit: {} as never,
    ...overrides,
  };
}

const editorData = {
  template: { projectId: 7, name: "Welcome", subject: "Hi", locale: "en", preheader: "p" },
  project: { id: 7, name: "Shop", aiProviderId: 3 },
  campaign: null,
  design: { rows: [] },
  mergeTags: [{ value: "{{name}}" }],
  baseUrl: "https://mail.example",
};
const editorPage = (id: string, campaignId?: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve(campaignId === undefined ? {} : { campaignId }),
});

describe("loadEditorPage", () => {
  it("loads the editor data as the user and maps it to the screen's props", async () => {
    const loadEditorData = vi.fn(async () => editorData);
    const props = await loadEditorPage(fakeHost({ template: { loadEditorData } }), editorPage("12", "5"));
    expect(loadEditorData).toHaveBeenCalledWith("u1", 12, 5);
    expect(props).toEqual({
      initialDesign: editorData.design,
      templateId: 12,
      projectId: 7,
      campaignId: 5,
      baseUrl: "https://mail.example",
      hasAiProvider: true,
      previewData: { workspaceName: "Shop" },
      templateName: "Welcome",
      templateSubject: "Hi",
      templateLocale: "en",
      templatePreheader: "p",
      mergeTags: editorData.mergeTags,
    });
  });

  it("passes no campaign when the query has none", async () => {
    const loadEditorData = vi.fn(async () => editorData);
    await loadEditorPage(fakeHost({ template: { loadEditorData } }), editorPage("12"));
    expect(loadEditorData).toHaveBeenCalledWith("u1", 12, null);
  });

  it.each(["abc", "0", "-1", "1.5", ""])("is a 404 for the id %j without reading", async (id) => {
    const loadEditorData = vi.fn();
    await expect(
      loadEditorPage(fakeHost({ template: { loadEditorData } }), editorPage(id)),
    ).rejects.toBeInstanceOf(NotFoundSignal);
    expect(loadEditorData).not.toHaveBeenCalled();
  });

  it("is a 404 for a bad campaign id", async () => {
    await expect(
      loadEditorPage(fakeHost({ template: { loadEditorData: vi.fn() } }), editorPage("12", "x")),
    ).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it.each([
    ["not found", new NotFoundError("Template")],
    ["forbidden", new ForbiddenError("Template")],
  ])("is a 404 when the service says %s", async (_, error) => {
    const loadEditorData = vi.fn(async () => {
      throw error;
    });
    await expect(
      loadEditorPage(fakeHost({ template: { loadEditorData } }), editorPage("12")),
    ).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("is a 404 without a session", async () => {
    const host = fakeHost(
      { template: { loadEditorData: vi.fn() } },
      {
        requireUserId: async () => {
          throw new UnauthorizedError();
        },
      },
    );
    await expect(loadEditorPage(host, editorPage("12"))).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("rethrows a fault instead of hiding it behind a 404", async () => {
    const fault = new Error("connection refused");
    const loadEditorData = vi.fn(async () => {
      throw fault;
    });
    await expect(
      loadEditorPage(fakeHost({ template: { loadEditorData } }), editorPage("12")),
    ).rejects.toBe(fault);
  });
});

describe("loadTriggerPage", () => {
  const page = (triggerId: string) => ({ params: Promise.resolve({ id: "7", triggerId }) });

  it("loads the details and the endpoint from the host's config", async () => {
    const details = { campaign: { id: 4 } };
    const getDetails = vi.fn(async () => details);
    const props = await loadTriggerPage(fakeHost({ campaign: { getDetails } }), page("4"));
    expect(getDetails).toHaveBeenCalledWith("u1", 4);
    expect(props).toEqual({
      details,
      apiEndpointUrl: "https://app.example/api/triggered",
      defaultFromEmail: "hi@example.com",
    });
  });

  it("is a 404 when the template is gone (null details)", async () => {
    const getDetails = vi.fn(async () => null);
    await expect(
      loadTriggerPage(fakeHost({ campaign: { getDetails } }), page("4")),
    ).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("is a 404 for a bad id", async () => {
    await expect(
      loadTriggerPage(fakeHost({ campaign: { getDetails: vi.fn() } }), page("x")),
    ).rejects.toBeInstanceOf(NotFoundSignal);
  });
});

describe("loadWorkflowPage", () => {
  const page = (workflowId: string) => ({ params: Promise.resolve({ id: "7", workflowId }) });

  it("returns the graph", async () => {
    const graph = { workflow: { id: 9 }, nodes: [], edges: [] };
    const getGraph = vi.fn(async () => graph);
    expect(await loadWorkflowPage(fakeHost({ workflow: { getGraph } }), page("9"))).toBe(graph);
    expect(getGraph).toHaveBeenCalledWith("u1", 9);
  });

  it("is a 404 for a foreign workflow and rethrows a fault", async () => {
    const foreign = vi.fn(async () => {
      throw new NotFoundError("Workflow");
    });
    await expect(
      loadWorkflowPage(fakeHost({ workflow: { getGraph: foreign } }), page("9")),
    ).rejects.toBeInstanceOf(NotFoundSignal);

    const fault = new Error("db down");
    const broken = vi.fn(async () => {
      throw fault;
    });
    await expect(
      loadWorkflowPage(fakeHost({ workflow: { getGraph: broken } }), page("9")),
    ).rejects.toBe(fault);
  });
});
