// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { DashboardActivity, DashboardEvent, DashboardStats } from "../domain";
import type { IDashboardRepository } from "../ports";

export interface DashboardData {
  stats: DashboardStats;
  activity: DashboardActivity[];
  events: DashboardEvent[];
}

/** The home and workspace dashboards. The repository scopes every query to the user's projects. */
export class DashboardService {
  constructor(private readonly dashboard: IDashboardRepository) {}

  getStats(userId: string, projectId?: number): Promise<DashboardStats> {
    return this.dashboard.getGlobalStats(userId, projectId);
  }

  getActivity(userId: string, days = 7, projectId?: number): Promise<DashboardActivity[]> {
    return this.dashboard.getActivityStats(userId, days, projectId);
  }

  getRecentEvents(userId: string, limit = 10, projectId?: number): Promise<DashboardEvent[]> {
    return this.dashboard.getRecentEvents(userId, limit, projectId);
  }

  async getData(
    userId: string,
    projectId: number,
    options: { days?: number; eventLimit?: number } = {},
  ): Promise<DashboardData> {
    const [stats, activity, events] = await Promise.all([
      this.getStats(userId, projectId),
      this.getActivity(userId, options.days ?? 7, projectId),
      this.getRecentEvents(userId, options.eventLimit ?? 10, projectId),
    ]);
    return { stats, activity, events };
  }
}
