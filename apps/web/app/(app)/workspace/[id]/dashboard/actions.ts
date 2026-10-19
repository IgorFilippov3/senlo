"use server";

import type { DashboardActivity, DashboardEvent, DashboardStats } from "@senlo/core";
import type { DashboardData } from "@senlo/core/server";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

export async function getDashboardStats(projectId?: number): Promise<DashboardStats> {
  const userId = await requireUserId();
  return getServices().dashboard.getStats(userId, projectId);
}

export async function getDashboardActivity(
  days: number = 7,
  projectId?: number,
): Promise<DashboardActivity[]> {
  const userId = await requireUserId();
  return getServices().dashboard.getActivity(userId, days, projectId);
}

export async function getRecentEvents(
  limit: number = 10,
  projectId?: number,
): Promise<DashboardEvent[]> {
  const userId = await requireUserId();
  return getServices().dashboard.getRecentEvents(userId, limit, projectId);
}

export async function getDashboardData(
  projectId: number,
  days: number = 7,
  eventLimit: number = 10,
): Promise<DashboardData> {
  const userId = await requireUserId();
  return getServices().dashboard.getData(userId, projectId, { days, eventLimit });
}
