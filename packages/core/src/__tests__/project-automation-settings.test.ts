import { describe, expect, it, vi } from "vitest";
import type { Project } from "../domain";
import { FormValidationError, NotFoundError } from "../errors";
import { ProjectService } from "../services/projectService";

function setup() {
  const rows = new Map<number, Project>([
    [1, { id: 1, userId: "alice", name: "A", createdAt: new Date(), updatedAt: new Date() }],
    [2, { id: 2, userId: "bob", name: "B", createdAt: new Date(), updatedAt: new Date() }],
  ]);
  const projects = {
    findById: async (id: number) => rows.get(id) ?? null,
    update: vi.fn(async (id: number, data: Partial<Project>) => {
      const row = rows.get(id);
      if (!row) return null;
      rows.set(id, { ...row, ...data });
      return rows.get(id)!;
    }),
  };
  const service = new ProjectService({ projects: projects as never, providers: {} as never, aiProviders: {} as never });
  return { service, projects, rows };
}

describe("workspace automation settings", () => {
  it("sets and removes the frequency cap", async () => {
    const { service, rows } = setup();
    expect(await service.getAutomationSettings("alice", 1)).toEqual({});
    expect(await service.updateAutomationSettings("alice", 1, { frequencyCap: { emails: 3, days: 7 } })).toEqual({
      frequencyCap: { emails: 3, days: 7 },
    });
    expect(rows.get(1)!.automationSettings).toEqual({ frequencyCap: { emails: 3, days: 7 } });
    expect(await service.updateAutomationSettings("alice", 1, { frequencyCap: null })).toEqual({});
  });

  it("refuses bad values and other users' workspaces", async () => {
    const { service, projects } = setup();
    await expect(service.updateAutomationSettings("alice", 1, { frequencyCap: { emails: 0, days: 7 } })).rejects.toBeInstanceOf(
      FormValidationError,
    );
    await expect(service.updateAutomationSettings("alice", 2, { frequencyCap: null })).rejects.toBeInstanceOf(NotFoundError);
    expect(projects.update).not.toHaveBeenCalled();
  });
});
