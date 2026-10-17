// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Project } from "./domain";
import type { IProjectRepository } from "./ports";
import { NotFoundError } from "./errors";

/**
 * The single answer to "may this user touch this?". Every entry point that
 * takes an id from a request - server action, API route - goes through here
 * before reading or changing anything, because a server action can be called
 * directly and a page-level check does not protect it.
 *
 * A missing record and someone else's record fail identically, with
 * `NotFoundError`: telling them apart would let a caller probe which ids exist.
 *
 * Today access means ownership: a project belongs to one user. When projects
 * gain organizations and roles, only this class changes.
 */
export class AccessGuard {
  constructor(private readonly projects: Pick<IProjectRepository, "findById">) {}

  /** The project, if the user may access it. */
  async requireProject(userId: string, projectId: number): Promise<Project> {
    // An empty user id must never match a project whose owner is also unset.
    if (!userId || !Number.isInteger(projectId) || projectId <= 0) {
      throw new NotFoundError("Project");
    }

    const project = await this.projects.findById(projectId);
    if (!project || !project.userId || project.userId !== userId) {
      throw new NotFoundError("Project");
    }
    return project;
  }

  /**
   * A record that lives inside a project (template, campaign, workflow,
   * suppression...), if the user may access its project. Pass the record as
   * loaded; `null` fails the same way as a foreign one.
   */
  async requireInProject<T extends { projectId?: number | null }>(
    userId: string,
    record: T | null | undefined,
    resource: string,
  ): Promise<T> {
    if (!record || record.projectId == null) {
      throw new NotFoundError(resource);
    }

    try {
      await this.requireProject(userId, record.projectId);
    } catch {
      throw new NotFoundError(resource);
    }
    return record;
  }

  /**
   * A record that must belong to one particular project the caller has
   * already been checked against - for ids that arrive alongside a project id,
   * such as a template id inside a trigger form.
   */
  requireSameProject<T extends { projectId?: number | null }>(
    projectId: number,
    record: T | null | undefined,
    resource: string,
  ): T {
    if (!record || record.projectId !== projectId) {
      throw new NotFoundError(resource);
    }
    return record;
  }

  /**
   * A record owned by a user directly rather than through a project (email
   * and AI providers, saved rows).
   */
  requireUserOwned<T extends { userId?: string | null }>(
    userId: string,
    record: T | null | undefined,
    resource: string,
  ): T {
    if (!userId || !record || record.userId !== userId) {
      throw new NotFoundError(resource);
    }
    return record;
  }
}
