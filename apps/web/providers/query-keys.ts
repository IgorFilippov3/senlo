import { QueryClient } from "@tanstack/react-query";

/**
 * Global QueryClient instance for imperative operations
 */
export const queryClient = new QueryClient();

/**
 * Centralized query key factory
 * Helps with cache invalidation and organization
 */
export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    lists: () => [...queryKeys.projects.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.projects.lists(), { filters }] as const,
    details: () => [...queryKeys.projects.all, "detail"] as const,
    detail: (id: number) => [...queryKeys.projects.details(), id] as const,
  },

  templates: {
    all: ["templates"] as const,
    lists: () => [...queryKeys.templates.all, "list"] as const,
    list: (projectId: number, filters?: Record<string, unknown>) =>
      [...queryKeys.templates.lists(), projectId, { filters }] as const,
    details: () => [...queryKeys.templates.all, "detail"] as const,
    detail: (id: number) => [...queryKeys.templates.details(), id] as const,
  },

  campaigns: {
    all: ["campaigns"] as const,
    lists: () => [...queryKeys.campaigns.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.campaigns.lists(), { filters }] as const,
    byProject: (projectId: number) =>
      [...queryKeys.campaigns.lists(), "project", projectId] as const,
    details: () => [...queryKeys.campaigns.all, "detail"] as const,
    detail: (id: number) => [...queryKeys.campaigns.details(), id] as const,
  },

  contacts: {
    all: ["contacts"] as const,
    lists: () => [...queryKeys.contacts.all, "list"] as const,
    byProject: (projectId: number) =>
      [...queryKeys.contacts.lists(), "project", projectId] as const,
    byList: (listId: number) =>
      [...queryKeys.contacts.lists(), "list", listId] as const,
    byProjectAndList: (projectId: number, listId: number) =>
      [
        ...queryKeys.contacts.lists(),
        "project",
        projectId,
        "list",
        listId,
      ] as const,
    details: () => [...queryKeys.contacts.all, "detail"] as const,
    detail: (id: number) => [...queryKeys.contacts.details(), id] as const,
  },

  recipientLists: {
    all: ["recipient-lists"] as const,
    lists: () => [...queryKeys.recipientLists.all, "list"] as const,
    byProject: (projectId: number) =>
      [...queryKeys.recipientLists.lists(), "project", projectId] as const,
    details: () => [...queryKeys.recipientLists.all, "detail"] as const,
    detail: (id: number) =>
      [...queryKeys.recipientLists.details(), id] as const,
  },

  emailProviders: {
    all: ["email-providers"] as const,
    lists: () => [...queryKeys.emailProviders.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.emailProviders.lists(), { filters }] as const,
    details: () => [...queryKeys.emailProviders.all, "detail"] as const,
    detail: (id: number) =>
      [...queryKeys.emailProviders.details(), id] as const,
  },

  aiProviders: {
    all: ["ai-providers"] as const,
    lists: () => [...queryKeys.aiProviders.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.aiProviders.lists(), { filters }] as const,
    details: () => [...queryKeys.aiProviders.all, "detail"] as const,
    detail: (id: number) => [...queryKeys.aiProviders.details(), id] as const,
  },

  apiKeys: {
    all: ["api-keys"] as const,
    lists: () => [...queryKeys.apiKeys.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.apiKeys.lists(), { filters }] as const,
    byProject: (projectId: number) =>
      [...queryKeys.apiKeys.lists(), "project", projectId] as const,
    details: () => [...queryKeys.apiKeys.all, "detail"] as const,
    detail: (id: number) => [...queryKeys.apiKeys.details(), id] as const,
  },
} as const;
