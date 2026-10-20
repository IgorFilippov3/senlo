"use server";

import type { DashboardData } from "@senlo/core/server";
import { requireUserId } from "@/lib/session";
import { getServices } from "@/lib/services";
import { withErrorHandling, type ActionResult } from "@/lib/errors";

export async function getDashboardData(
  projectId: number,
  days: number = 7,
  eventLimit: number = 10,
): Promise<ActionResult<DashboardData>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().dashboard.getData(userId, projectId, { days, eventLimit });
  });
}
