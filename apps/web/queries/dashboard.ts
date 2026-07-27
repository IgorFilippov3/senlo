import { useQuery } from "@tanstack/react-query";
import {
  getDashboardStats,
  getDashboardActivity,
  getRecentEvents,
  getDashboardData,
} from "../app/(app)/workspace/[id]/dashboard/actions";
import { queryKeys } from "../providers/query-keys";

export function useDashboardData(
  projectId: number,
  days: number = 7,
  eventLimit: number = 10,
) {
  return useQuery({
    queryKey: [
      ...queryKeys.dashboard.all,
      "combined",
      projectId,
      days,
      eventLimit,
    ],
    queryFn: () => getDashboardData(projectId, days, eventLimit),
    enabled: !!projectId,
  });
}

export function useDashboardStats(projectId?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(projectId),
    queryFn: () => getDashboardStats(projectId),
    enabled: true,
  });
}

export function useDashboardActivity(days: number = 7, projectId?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.activity(projectId, days),
    queryFn: () => getDashboardActivity(days, projectId),
    enabled: true,
  });
}

export function useDashboardEvents(limit: number = 10, projectId?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.events(projectId, limit),
    queryFn: () => getRecentEvents(limit, projectId),
    enabled: true,
  });
}
