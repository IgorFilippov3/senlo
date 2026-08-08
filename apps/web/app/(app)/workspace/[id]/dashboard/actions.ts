"use server";

import { DashboardRepository, db } from "@senlo/db";
import { auth } from "apps/web/auth";
import { logger } from "apps/web/lib/logger";

const dashboardRepo = new DashboardRepository(db);

export async function getDashboardStats(projectId?: number) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    return await dashboardRepo.getGlobalStats(userId, projectId);
  } catch (error) {
    logger.error("Failed to fetch dashboard stats", {
      error,
      userId,
      projectId,
    });
    throw new Error("Failed to fetch dashboard stats");
  }
}

export async function getDashboardActivity(
  days: number = 7,
  projectId?: number,
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    return await dashboardRepo.getActivityStats(userId, days, projectId);
  } catch (error) {
    logger.error("Failed to fetch dashboard activity", {
      error,
      userId,
      projectId,
    });
    throw new Error("Failed to fetch dashboard activity");
  }
}

export async function getRecentEvents(limit: number = 10, projectId?: number) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    return await dashboardRepo.getRecentEvents(userId, limit, projectId);
  } catch (error) {
    logger.error("Failed to fetch recent events", { error, userId, projectId });
    throw new Error("Failed to fetch recent events");
  }
}

import { DashboardStats, DashboardActivity, DashboardEvent } from "@senlo/core";

export async function getDashboardData(
  projectId: number,
  days: number = 7,
  eventLimit: number = 10,
): Promise<{
  stats: DashboardStats;
  activity: DashboardActivity[];
  events: DashboardEvent[];
}> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const [stats, activity, events] = await Promise.all([
      dashboardRepo.getGlobalStats(userId, projectId),
      dashboardRepo.getActivityStats(userId, days, projectId),
      dashboardRepo.getRecentEvents(userId, eventLimit, projectId),
    ]);

    return { stats, activity, events };
  } catch (error) {
    logger.error("Failed to fetch combined dashboard data", {
      error,
      userId,
      projectId,
    });
    throw new Error("Failed to fetch dashboard data");
  }
}
