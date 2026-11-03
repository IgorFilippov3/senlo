// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AccessGuard, listInScope } from "../access";
import type { DashboardActivity, DashboardEvent, DashboardStats } from "../domain";
import type { IDashboardRepository, IProjectRepository } from "../ports";
import { boundedInt } from "../validation";

/** Longest activity window and most recent events a caller can ask for. */
const MAX_DAYS = 365;
const MAX_EVENTS = 100;

const activityDays = (days: unknown) =>
  boundedInt(days, { field: "days", min: 1, max: MAX_DAYS, fallback: 7 });
const eventLimit = (limit: unknown) =>
  boundedInt(limit, { field: "eventLimit", min: 1, max: MAX_EVENTS, fallback: 10 });

export interface DashboardData {
  stats: DashboardStats;
  activity: DashboardActivity[];
  events: DashboardEvent[];
}

/**
 * The home and workspace dashboards. Which projects count is decided here:
 * one project the user may access, or every project in their scope; the
 * repository only aggregates over the ids it is given.
 */
export class DashboardService {
  private readonly access: AccessGuard;

  constructor(
    private readonly dashboard: IDashboardRepository,
    private readonly projects: Pick<IProjectRepository, "findById" | "listForUser" | "listForOrganization">,
    access?: AccessGuard,
  ) {
    this.access = access ?? new AccessGuard(projects);
  }

  /** The one project, checked, or the whole scope. */
  private async projectIds(userId: string, projectId?: number): Promise<number[]> {
    if (projectId !== undefined) {
      return [(await this.access.requireProject(userId, projectId, "read")).id];
    }
    return (await listInScope(await this.access.scopeFor(userId), this.projects)).map((p) => p.id);
  }

  async getStats(userId: string, projectId?: number): Promise<DashboardStats> {
    return this.dashboard.getGlobalStats(await this.projectIds(userId, projectId));
  }

  async getActivity(userId: string, days = 7, projectId?: number): Promise<DashboardActivity[]> {
    const span = activityDays(days);
    return this.dashboard.getActivityStats(await this.projectIds(userId, projectId), span);
  }

  async getRecentEvents(userId: string, limit = 10, projectId?: number): Promise<DashboardEvent[]> {
    const max = eventLimit(limit);
    return this.dashboard.getRecentEvents(await this.projectIds(userId, projectId), max);
  }

  async getData(
    userId: string,
    projectId: number,
    options: { days?: number; eventLimit?: number } = {},
  ): Promise<DashboardData> {
    const days = activityDays(options.days);
    const limit = eventLimit(options.eventLimit);
    const projectIds = await this.projectIds(userId, projectId);
    const [stats, activity, events] = await Promise.all([
      this.dashboard.getGlobalStats(projectIds),
      this.dashboard.getActivityStats(projectIds, days),
      this.dashboard.getRecentEvents(projectIds, limit),
    ]);
    return { stats, activity, events };
  }
}
