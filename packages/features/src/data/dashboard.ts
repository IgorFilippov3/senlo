"use client";

import { useQuery } from "@tanstack/react-query";
import { useSenloActions } from "./provider";
import { queryKeys } from "./query-keys";
import { unwrap } from "./result";

export function useDashboardData(projectId: number, days = 7, eventLimit = 10) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.dashboard.data(projectId, days, eventLimit),
    queryFn: async () => unwrap(await actions.dashboard.get(projectId, { days, eventLimit })),
    enabled: !!projectId,
  });
}
