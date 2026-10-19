// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard } from "../access";
import type { Project } from "../domain";
import { NotFoundError } from "../errors";
import type {
  IAiProviderRepository,
  IEmailProviderRepository,
  IProjectRepository,
} from "../ports";
import { parseInput } from "../validation";

/** A select whose "no choice" option arrives as "", "none" or nothing. */
const optionalReference = z.preprocess(
  (val) => (val === "" || val === "none" || val === null || val === undefined ? null : val),
  z.coerce.number().int().positive().nullable(),
);

export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(255),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || null),
});

export const UpdateWorkspaceSchema = CreateWorkspaceSchema.extend({
  providerId: optionalReference,
  aiProviderId: optionalReference,
});

export type CreateWorkspaceInput = z.input<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.input<typeof UpdateWorkspaceSchema>;

export interface ProjectServiceRepositories {
  projects: IProjectRepository;
  providers: Pick<IEmailProviderRepository, "findById">;
  aiProviders: Pick<IAiProviderRepository, "findById">;
}

/**
 * Workspaces (projects). A project belongs to one user; the providers it
 * points at must be that user's own, or a workspace could be pointed at
 * someone else's credentials.
 */
export class ProjectService {
  private readonly access: AccessGuard;

  constructor(private readonly repos: ProjectServiceRepositories) {
    this.access = new AccessGuard(repos.projects);
  }

  listForUser(userId: string): Promise<Project[]> {
    return this.repos.projects.findByUser(userId);
  }

  /** The project, if it is the user's. */
  require(userId: string, projectId: number): Promise<Project> {
    return this.access.requireProject(userId, projectId);
  }

  async create(userId: string, rawInput: unknown): Promise<Project> {
    const input = parseInput(CreateWorkspaceSchema, rawInput);
    return this.repos.projects.create({
      name: input.name,
      description: input.description,
      userId,
    });
  }

  async update(userId: string, projectId: number, rawInput: unknown): Promise<Project> {
    await this.access.requireProject(userId, projectId);
    const input = parseInput(UpdateWorkspaceSchema, rawInput);

    if (input.providerId) {
      this.access.requireUserOwned(
        userId,
        await this.repos.providers.findById(input.providerId),
        "Email provider",
      );
    }
    if (input.aiProviderId) {
      this.access.requireUserOwned(
        userId,
        await this.repos.aiProviders.findById(input.aiProviderId),
        "AI provider",
      );
    }

    const updated = await this.repos.projects.update(projectId, {
      name: input.name,
      description: input.description,
      providerId: input.providerId,
      aiProviderId: input.aiProviderId,
    });
    if (!updated) throw new NotFoundError("Project");
    return updated;
  }

  async delete(userId: string, projectId: number): Promise<void> {
    await this.access.requireProject(userId, projectId);
    await this.repos.projects.delete(projectId);
  }
}
