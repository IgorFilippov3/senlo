"use server";

import { DashboardRepository } from "@senlo/db";
import { auth } from "apps/web/auth";
import { logger } from "apps/web/lib/logger";

const dashboardRepo = new DashboardRepository();

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    return await dashboardRepo.getGlobalStats(session.user.id);
  } catch (error) {
    logger.error("Failed to fetch dashboard stats", { error, userId: session.user.id });
    throw new Error("Failed to fetch dashboard stats");
  }
}

export async function getDashboardActivity(days: number = 7) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    return await dashboardRepo.getActivityStats(session.user.id, days);
  } catch (error) {
    logger.error("Failed to fetch dashboard activity", { error, userId: session.user.id });
    throw new Error("Failed to fetch dashboard activity");
  }
}

export async function getRecentEvents(limit: number = 10) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    return await dashboardRepo.getRecentEvents(session.user.id, limit);
  } catch (error) {
    logger.error("Failed to fetch recent events", { error, userId: session.user.id });
    throw new Error("Failed to fetch recent events");
  }
}
