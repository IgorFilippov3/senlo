/** Every query key the data hooks use, so invalidation has one place to look. */
export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    lists: () => [...queryKeys.projects.all, "list"] as const,
    detail: (id: number) => [...queryKeys.projects.all, "detail", id] as const,
  },
  templates: {
    all: ["templates"] as const,
    lists: () => [...queryKeys.templates.all, "list"] as const,
    byProject: (projectId: number) => [...queryKeys.templates.lists(), projectId] as const,
  },
  campaigns: {
    all: ["campaigns"] as const,
    lists: () => [...queryKeys.campaigns.all, "list"] as const,
    byProject: (projectId: number) => [...queryKeys.campaigns.lists(), "project", projectId] as const,
    detail: (id: number) => [...queryKeys.campaigns.all, "detail", id] as const,
    events: (campaignId: number, params: Record<string, unknown>) =>
      [...queryKeys.campaigns.detail(campaignId), "events", params] as const,
    links: (campaignId: number) => [...queryKeys.campaigns.detail(campaignId), "links"] as const,
    timeSeries: (campaignId: number, options: Record<string, unknown>) =>
      [...queryKeys.campaigns.detail(campaignId), "time-series", options] as const,
  },
  emailProviders: {
    all: ["email-providers"] as const,
    list: () => [...queryKeys.emailProviders.all, "list"] as const,
  },
  aiProviders: {
    all: ["ai-providers"] as const,
    list: () => [...queryKeys.aiProviders.all, "list"] as const,
  },
  apiKeys: {
    all: ["api-keys"] as const,
    byProject: (projectId: number) => [...queryKeys.apiKeys.all, "project", projectId] as const,
  },
  suppressions: {
    all: ["suppressions"] as const,
    byProject: (projectId: number) => [...queryKeys.suppressions.all, "project", projectId] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    data: (projectId: number, days: number, eventLimit: number) =>
      [...queryKeys.dashboard.all, projectId, days, eventLimit] as const,
  },
  workflows: {
    all: ["workflows"] as const,
    lists: () => [...queryKeys.workflows.all, "list"] as const,
    byProject: (projectId: number) => [...queryKeys.workflows.lists(), projectId] as const,
    stats: (id: number) => [...queryKeys.workflows.all, "stats", id] as const,
  },
} as const;
