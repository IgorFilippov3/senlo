// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Queue } from "bullmq";
import type { MailSettings } from "./config";
import type {
  ContactRepository,
  IApiKeyRepository,
  ICampaignRepository,
  IEmailProviderRepository,
  IEmailTemplateRepository,
  IProjectRepository,
  ISuppressionRepository,
  ITriggeredSendLogRepository,
  IWorkflowExecutionRepository,
  IWorkflowRepository,
  RecipientListRepository,
} from "./ports";
import type { AutomationJobData, EmailJobData } from "./queue/types";
import { AudienceService } from "./services/audienceService";
import { AuthService } from "./services/authService";
import { AutomationService } from "./services/automationService";
import { CampaignService } from "./services/campaignService";
import { TemplateService } from "./services/emailTemplateService";
import { ProjectService } from "./services/projectService";
import { SettingsService } from "./services/settingsService";
import { TrackingService } from "./services/trackingService";
import { TriggerService } from "./services/triggerService";

/**
 * The repositories the services are built from, as interfaces. `@senlo/db`
 * provides them (`createRepositories(db)`); core cannot, because db depends
 * on core and not the other way round.
 */
export interface Repositories {
  apiKeys: IApiKeyRepository;
  campaigns: ICampaignRepository;
  contacts: ContactRepository;
  executions: IWorkflowExecutionRepository;
  lists: RecipientListRepository;
  projects: IProjectRepository;
  providers: IEmailProviderRepository;
  sendLogs: ITriggeredSendLogRepository;
  suppressions: ISuppressionRepository;
  templates: IEmailTemplateRepository;
  workflows: IWorkflowRepository;
}

export interface ServiceQueues {
  email: Queue<EmailJobData>;
  automation: Queue<AutomationJobData>;
}

export interface Services {
  audience: AudienceService;
  auth: AuthService;
  automation: AutomationService;
  campaign: CampaignService;
  project: ProjectService;
  settings: SettingsService;
  template: TemplateService;
  tracking: TrackingService;
  trigger: TriggerService;
}

/**
 * Every service, wired once. The graph - trigger, then automation, then
 * audience - used to be assembled by hand in each file that needed it; an
 * app now calls this and a second app gets exactly the same wiring.
 */
export function createServices({
  repositories: r,
  queues,
  settings,
}: {
  repositories: Repositories;
  queues: ServiceQueues;
  settings: MailSettings;
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

  return {
    trigger,
    automation,
    audience: new AudienceService(r.suppressions, r.contacts, r.workflows, automation),
    auth: new AuthService(r.apiKeys),
    campaign: new CampaignService(r.campaigns, r.templates, r.lists),
    project: new ProjectService(r.projects),
    settings: new SettingsService(r.apiKeys, r.projects),
    template: new TemplateService(r.templates),
    tracking: new TrackingService(r.campaigns),
  };
}
