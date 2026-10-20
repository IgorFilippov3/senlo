import type { SenloActions } from "@senlo/features";
import * as workspaces from "@/app/(app)/workspace/actions";
import * as templates from "@/app/(app)/workspace/[id]/templates/actions";
import * as campaigns from "@/app/(app)/workspace/[id]/triggers/actions";
import * as emailProviders from "@/app/(app)/providers/actions";
import * as aiProviders from "@/app/(app)/providers/ai-actions";
import * as apiKeys from "@/app/(app)/workspace/[id]/settings/keys/actions";
import * as suppressions from "@/app/(app)/workspace/[id]/audience/suppressions/actions";
import * as dashboard from "@/app/(app)/workspace/[id]/dashboard/actions";
import * as workflows from "@/app/(app)/workspace/[id]/automations/actions";

/**
 * The client data layer's transport in self-hosted: each call is a Server
 * Action. Another shell passes its own `SenloActions` to `SenloDataProvider`.
 */
export const clientActions: SenloActions = {
  workspaces: {
    list: workspaces.listWorkspaces,
    create: workspaces.createWorkspace,
    update: workspaces.updateWorkspace,
    delete: workspaces.deleteWorkspace,
  },
  templates: {
    list: templates.listProjectTemplates,
    create: templates.createTemplate,
    delete: templates.deleteTemplate,
  },
  campaigns: {
    listForProject: campaigns.listProjectCampaigns,
    events: (id, { page, pageSize, type, search }) =>
      campaigns.getPaginatedCampaignEvents(id, page, pageSize, type, search),
    linkStats: campaigns.getCampaignLinkStats,
    timeSeries: campaigns.getCampaignTimeSeriesStats,
    createTriggered: campaigns.createCampaignAction,
    updateTriggered: campaigns.updateCampaignAction,
    delete: campaigns.deleteCampaignAction,
  },
  emailProviders: {
    list: emailProviders.listProviders,
    create: emailProviders.createProviderAction,
    update: emailProviders.updateProviderAction,
    toggle: emailProviders.toggleProviderAction,
    delete: emailProviders.deleteProviderAction,
  },
  aiProviders: {
    list: aiProviders.listAiProviders,
    create: aiProviders.createAiProviderAction,
    toggle: aiProviders.toggleAiProviderAction,
    delete: aiProviders.deleteAiProviderAction,
  },
  apiKeys: {
    list: apiKeys.listApiKeys,
    create: apiKeys.createApiKey,
    delete: apiKeys.deleteApiKey,
  },
  suppressions: {
    listForProject: suppressions.listProjectSuppressions,
    delete: suppressions.deleteSuppressionAction,
  },
  dashboard: {
    get: (projectId, { days, eventLimit }) => dashboard.getDashboardData(projectId, days, eventLimit),
  },
  workflows: {
    list: workflows.listWorkflows,
    create: workflows.createWorkflow,
    saveGraph: (id, { nodes, edges }) => workflows.saveWorkflowGraph(id, nodes, edges),
    setStatus: workflows.updateWorkflowStatus,
    delete: workflows.deleteWorkflow,
    stats: workflows.getWorkflowStats,
  },
};
