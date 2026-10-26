// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Project } from "./domain";
import type { IProjectRepository } from "./ports";
import { ForbiddenError, NotFoundError } from "./errors";

/**
 * Whose records "mine" means for a user: their own (`organizationId: null`,
 * always the case in self-hosted) or an organization's. `userId` is the
 * caller either way, kept as the creator of what they add.
 */
export interface OwnerScope {
  userId: string;
  organizationId: string | null;
}

/** The ownership fields of a record that can belong to a user or an organization. */
export interface OwnedRecord {
  userId?: string | null;
  organizationId?: string | null;
}

/**
 * What the caller is about to do with a record. `read` covers everything that
 * changes nothing stored (viewing, stats, previews, AI generation); `write`
 * is creating inside it, editing, deleting, sending.
 */
export type AccessAction = "read" | "write";

/**
 * The access decision, as a port. Self-hosted uses `ownerAccessPolicy`; a
 * managed install passes a membership-based one to `createServices({ access })`.
 * `AccessGuard` asks it and turns every "no" into the same `NotFoundError`, so
 * an implementation cannot leak which ids exist.
 */
export interface AccessPolicy {
  /** The scope the user's lists and new records belong to. */
  scopeFor(userId: string): Promise<OwnerScope>;
  /**
   * May the user do `action` on a record owned this way (a project, a
   * provider)? A role that reads but does not write answers per action.
   */
  mayAccess(userId: string, owner: OwnedRecord, action: AccessAction): Promise<boolean>;
  /**
   * May the user add a top-level record (a project, a provider) to `scope`?
   * Absent means yes: in self-hosted the owner may always create. A managed
   * policy answers by role, so a viewer cannot create through any entry point.
   */
  mayCreate?(userId: string, scope: OwnerScope): Promise<boolean>;
}

/** Today's rule: a record belongs to the user in its `userId`, nothing is shared, and the owner may do anything. */
export const ownerAccessPolicy: AccessPolicy = {
  async scopeFor(userId) {
    return { userId, organizationId: null };
  },
  async mayAccess(userId, owner) {
    // An empty user id must never match a record whose owner is also unset.
    return !!userId && !!owner.userId && owner.userId === userId;
  },
};

/** A repository whose rows can belong to a user or to an organization. */
export interface ScopedListing<T> {
  listForUser(userId: string): Promise<T[]>;
  listForOrganization(organizationId: string): Promise<T[]>;
}

/** The rows "mine" means in this scope: the organization's, or the user's own. */
export function listInScope<T>(scope: OwnerScope, repository: ScopedListing<T>): Promise<T[]> {
  return scope.organizationId
    ? repository.listForOrganization(scope.organizationId)
    : repository.listForUser(scope.userId);
}

/** For a guard that never checks projects: every project lookup finds nothing. */
const noProjects: Pick<IProjectRepository, "findById"> = {
  async findById() {
    return null;
  },
};

/**
 * The single answer to "may this user touch this?". Every entry point that
 * takes an id from a request - server action, API route - goes through here
 * before reading or changing anything, because a server action can be called
 * directly and a page-level check does not protect it.
 *
 * A missing record and someone else's record fail identically, with
 * `NotFoundError`: telling them apart would let a caller probe which ids exist.
 *
 * Who may access what is the `AccessPolicy`'s call; `createServices` builds
 * one guard over it and hands it to every service.
 */
export class AccessGuard {
  constructor(
    private readonly projects: Pick<IProjectRepository, "findById">,
    private readonly policy: AccessPolicy = ownerAccessPolicy,
  ) {}

  /** A guard for services that check owned records only (providers), never projects. */
  static forOwnedRecords(policy: AccessPolicy = ownerAccessPolicy): AccessGuard {
    return new AccessGuard(noProjects, policy);
  }

  /** See `AccessPolicy.scopeFor`. */
  scopeFor(userId: string): Promise<OwnerScope> {
    return this.policy.scopeFor(userId);
  }

  /**
   * The scope a new top-level record goes into, if the policy lets the user
   * create there; `ForbiddenError` otherwise. Every `create` of a project or
   * provider takes its scope from here, not from `scopeFor`.
   */
  async requireCreate(userId: string, resource: string): Promise<OwnerScope> {
    if (!userId) throw new NotFoundError(resource);
    const scope = await this.policy.scopeFor(userId);
    if (this.policy.mayCreate && !(await this.policy.mayCreate(userId, scope))) {
      throw new ForbiddenError(resource, `You cannot create a ${resource.toLowerCase()} here`);
    }
    return scope;
  }

  /**
   * Passes when the policy allows `action`. A refused write on a record the
   * user may read is `ForbiddenError`; every other refusal is `NotFoundError`,
   * the same as a missing record.
   */
  private async decide(
    userId: string,
    owner: OwnedRecord,
    action: AccessAction,
    resource: string,
  ): Promise<void> {
    if (await this.policy.mayAccess(userId, owner, action)) return;
    if (action === "write" && (await this.policy.mayAccess(userId, owner, "read"))) {
      throw new ForbiddenError(resource);
    }
    throw new NotFoundError(resource);
  }

  /** The project, if the user may do `action` on it. */
  async requireProject(userId: string, projectId: number, action: AccessAction): Promise<Project> {
    if (!userId || !Number.isInteger(projectId) || projectId <= 0) {
      throw new NotFoundError("Project");
    }

    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError("Project");
    await this.decide(userId, project, action, "Project");
    return project;
  }

  /**
   * A record that lives inside a project (template, campaign, workflow,
   * suppression...), if the user may do `action` on its project. Pass the
   * record as loaded; `null` fails the same way as a foreign one. Errors name
   * the record, not the project.
   */
  async requireInProject<T extends { projectId?: number | null }>(
    userId: string,
    record: T | null | undefined,
    resource: string,
    action: AccessAction,
  ): Promise<T> {
    if (!userId || !record || record.projectId == null) {
      throw new NotFoundError(resource);
    }

    const project = await this.projects.findById(record.projectId);
    if (!project) throw new NotFoundError(resource);
    await this.decide(userId, project, action, resource);
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
   * A record owned by a user or an organization rather than through a
   * project (email and AI providers), if the policy lets the user do `action`.
   */
  async requireOwned<T extends OwnedRecord>(
    userId: string,
    record: T | null | undefined,
    resource: string,
    action: AccessAction,
  ): Promise<T> {
    if (!userId || !record) throw new NotFoundError(resource);
    await this.decide(userId, record, action, resource);
    return record;
  }

  /**
   * A record that only ever belongs to one user, whatever the policy (saved
   * rows: a personal snippet library, never shared with an organization).
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
