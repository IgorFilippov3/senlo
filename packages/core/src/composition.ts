// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Queue } from "bullmq";
import type { MailSettings } from "./config";
import { consoleLogger, type Logger } from "./logger";
import type {
  ContactRepository,
  IAiProviderRepository,
  IDashboardRepository,
  IApiKeyRepository,
  ICampaignRepository,
  IEmailProviderRepository,
  IEmailTemplateRepository,
  IProjectRepository,
  ISavedRowRepository,
  IUserRepository,
  ISuppressionRepository,
  ITriggeredSendLogRepository,
  IWorkflowExecutionRepository,
  IWorkflowRepository,
  RecipientListRepository,
} from "./ports";
import type { AutomationJobData, CampaignJobData, EmailJobData } from "./queue/types";
import { AiDesignService, AiProviderService } from "./services/ai";
import { AudienceService } from "./services/audienceService";
import { AuthService } from "./services/authService";
import { AutomationService } from "./services/automationService";
import { CampaignService } from "./services/campaignService";
import { DashboardService } from "./services/dashboardService";
import { EmailProviderService } from "./services/emailProviderService";
import { TemplateService } from "./services/emailTemplateService";
import { EventIngestionService } from "./services/eventIngestionService";
import { ProjectService } from "./services/projectService";
import { SavedRowService } from "./services/savedRowService";
import { SettingsService } from "./services/settingsService";
import { UploadService, type StoragePort } from "./services/storage";
import { TrackingService } from "./services/trackingService";
import { TriggerService } from "./services/triggerService";
import { UnsubscribeService } from "./services/unsubscribeService";
import { UserService, type UserServiceOptions } from "./services/userService";
import { WebhookService } from "./services/webhook";
import { WorkflowService } from "./services/workflowService";

/**
 * The repositories the services are built from, as interfaces. `@senlo/db`
 * provides them (`createRepositories(db)`); core cannot, because db depends
 * on core and not the other way round.
 */
export interface Repositories {
  aiProviders: IAiProviderRepository;
  apiKeys: IApiKeyRepository;
  campaigns: ICampaignRepository;
  contacts: ContactRepository;
  dashboard: IDashboardRepository;
  executions: IWorkflowExecutionRepository;
  lists: RecipientListRepository;
  projects: IProjectRepository;
  providers: IEmailProviderRepository;
  savedRows: ISavedRowRepository;
  sendLogs: ITriggeredSendLogRepository;
  suppressions: ISuppressionRepository;
  templates: IEmailTemplateRepository;
  users: IUserRepository;
  workflows: IWorkflowRepository;
}

export interface ServiceQueues {
  email: Queue<EmailJobData>;
  automation: Queue<AutomationJobData>;
  campaign: Queue<CampaignJobData>;
}

export interface Services {
  aiDesign: AiDesignService;
  aiProvider: AiProviderService;
  audience: AudienceService;
  auth: AuthService;
  automation: AutomationService;
  campaign: CampaignService;
  dashboard: DashboardService;
  emailProvider: EmailProviderService;
  events: EventIngestionService;
  project: ProjectService;
  savedRow: SavedRowService;
  settings: SettingsService;
  template: TemplateService;
  tracking: TrackingService;
  trigger: TriggerService;
  upload: UploadService;
  unsubscribe: UnsubscribeService;
  user: UserService;
  webhook: WebhookService;
  workflow: WorkflowService;
}

const noStorage: StoragePort = {
  async put() {
    throw new Error("No storage configured: pass `storage` to createServices");
  },
};

/**
 * Every service, wired once. The graph - trigger, then automation, then
 * audience - used to be assembled by hand in each file that needed it; an
 * app now calls this and a second app gets exactly the same wiring.
 */
export function createServices({
  repositories: r,
  queues,
  settings,
  storage,
  logger = consoleLogger,
  onUserCreated,
}: {
  repositories: Repositories;
  queues: ServiceQueues;
  settings: MailSettings;
  /** Where uploads go; `LocalDiskStorage` for self-hosted. A process that never takes uploads (the worker) can leave it out. */
  storage?: StoragePort;
  logger?: Logger;
  /** See `UserServiceOptions.onUserCreated`. */
  onUserCreated?: UserServiceOptions["onUserCreated"];
}): Services {
  const trigger = new TriggerService(
    r.campaigns,
    r.templates,
    r.providers,
    r.projects,
    r.sendLogs,
    queues.email,
    settings,
  );
  const automation = new AutomationService(
    r.workflows,
    r.executions,
    r.contacts,
    queues.automation,
    trigger,
  );

  const audience = new AudienceService(r.suppressions, r.contacts, r.workflows, automation, r.projects);

  return {
    trigger,
    automation,
    audience,
    events: new EventIngestionService(r.contacts, audience, automation),
    aiDesign: new AiDesignService(r.projects, r.aiProviders),
    aiProvider: new AiProviderService(r.aiProviders),
    auth: new AuthService(r.apiKeys),
    campaign: new CampaignService(r, queues.campaign),
    dashboard: new DashboardService(r.dashboard),
    emailProvider: new EmailProviderService(r.providers),
    project: new ProjectService(r),
    settings: new SettingsService(r.apiKeys, r.projects),
    savedRow: new SavedRowService(r.savedRows, r.projects),
    template: new TemplateService(r, queues.email, settings),
    tracking: new TrackingService(r, settings),
    unsubscribe: new UnsubscribeService(r, settings),
    upload: new UploadService(storage ?? noStorage),
    user: new UserService(r.users, undefined, { onUserCreated, logger }),
    webhook: new WebhookService(r, logger),
    workflow: new WorkflowService(r),
  };
}
