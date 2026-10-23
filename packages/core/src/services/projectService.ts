// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard, listInScope, type AccessAction } from "../access";
import { ServiceHooks } from "../hooks";
import type { Project } from "../domain";
import { NotFoundError } from "../errors";
import type {
  IAiProviderRepository,
  IEmailProviderRepository,
  IProjectRepository,
} from "../ports";
import { parseInput } from "../validation";

export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(255),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || null),
});

/**
 * A reference in an update: absent keeps the stored one; "", "none" or null
 * clears it. (It used to clear on absent too, so a form that did not send a
 * picker unlinked that provider.)
 */
const referenceUpdate = z.preprocess(
  (val) => (val === "" || val === "none" ? null : val),
  z.coerce.number().int().positive().nullable().optional(),
);

/**
 * A partial update: every field may be left out, and a left-out field keeps
 * its stored value. Clearing is explicit: "" for the description, "", "none"
 * or null for a provider.
 */
export const UpdateWorkspaceSchema = z.object({
  name: CreateWorkspaceSchema.shape.name.optional(),
  description: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  providerId: referenceUpdate,
  aiProviderId: referenceUpdate,
});

export type CreateWorkspaceInput = z.input<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.input<typeof UpdateWorkspaceSchema>;

export interface ProjectServiceRepositories {
  projects: IProjectRepository;
  providers: Pick<IEmailProviderRepository, "findById">;
  aiProviders: Pick<IAiProviderRepository, "findById">;
}

/**
 * Workspaces (projects). The providers a project points at must be ones the
 * user may access too, or a workspace could be pointed at someone else's
 * credentials.
 */
export class ProjectService {
  private readonly access: AccessGuard;

  constructor(
    private readonly repos: ProjectServiceRepositories,
    access?: AccessGuard,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
  ) {
    this.access = access ?? new AccessGuard(repos.projects);
  }

  /** The projects in the user's scope (their own, or their organization's). */
  async listForUser(userId: string): Promise<Project[]> {
    return listInScope(await this.access.scopeFor(userId), this.repos.projects);
  }

  /** The project, if it is the user's. */
  require(userId: string, projectId: number, action: AccessAction): Promise<Project> {
    return this.access.requireProject(userId, projectId, action);
  }

  async create(userId: string, rawInput: unknown): Promise<Project> {
    const input = parseInput(CreateWorkspaceSchema, rawInput);
    const scope = await this.access.scopeFor(userId);
    await this.hooks.requireQuota({ type: "project.create", scope });
    const project = await this.repos.projects.create({
      name: input.name,
      description: input.description,
      userId,
      organizationId: scope.organizationId,
    });
    await this.hooks.recordUsage({ type: "project.created", projectId: project.id, scope });
    await this.hooks.audit({
      actor: { userId },
      action: "project.created",
      target: { type: "project", id: project.id, projectId: project.id },
    });
    return project;
  }

  async update(userId: string, projectId: number, rawInput: unknown): Promise<Project> {
    await this.access.requireProject(userId, projectId, "write");
    const input = parseInput(UpdateWorkspaceSchema, rawInput);

    if (input.providerId) {
      await this.access.requireOwned(
        userId,
        await this.repos.providers.findById(input.providerId),
        "Email provider",
        // Linking uses the provider; it does not change it.
        "read",
      );
    }
    if (input.aiProviderId) {
      await this.access.requireOwned(
        userId,
        await this.repos.aiProviders.findById(input.aiProviderId),
        "AI provider",
        "read",
      );
    }

    // Absent fields are left out, not passed as undefined: a repository
    // should not have to know that undefined means "keep".
    const changes = Object.fromEntries(
      Object.entries({
        name: input.name,
        description: input.description,
        providerId: input.providerId,
        aiProviderId: input.aiProviderId,
      }).filter(([, v]) => v !== undefined),
    );
    const updated = await this.repos.projects.update(projectId, changes);
    if (!updated) throw new NotFoundError("Project");
    await this.hooks.audit({
      actor: { userId },
      action: "project.updated",
      target: { type: "project", id: projectId, projectId },
      // Only what the update named: an absent field was not touched.
      details: Object.fromEntries(
        Object.entries({ providerId: input.providerId, aiProviderId: input.aiProviderId }).filter(
          ([, v]) => v !== undefined,
        ),
      ),
    });
    return updated;
  }

  async delete(userId: string, projectId: number): Promise<void> {
    await this.access.requireProject(userId, projectId, "write");
    await this.repos.projects.delete(projectId);
    await this.hooks.audit({
      actor: { userId },
      action: "project.deleted",
      target: { type: "project", id: projectId, projectId },
    });
  }
}
