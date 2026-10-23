// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SecretCipher } from "@senlo/core";
import type { Repositories } from "@senlo/core/server";
import type { Database } from "./client";
import { AiProviderRepository } from "./repositories/aiProviderRepository";
import { ApiKeyRepository } from "./repositories/apiKeyRepository";
import { CampaignRepository } from "./repositories/campaignRepository";
import { ContactRepository } from "./repositories/contactRepository";
import { DashboardRepository } from "./repositories/dashboardRepository";
import { EmailProviderRepository } from "./repositories/emailProviderRepository";
import { EmailTemplateRepository } from "./repositories/emailTemplateRepository";
import { ProjectRepository } from "./repositories/projectRepository";
import { SavedRowRepository } from "./repositories/savedRowRepository";
import { SuppressionRepository } from "./repositories/suppressionRepository";
import { TriggeredSendLogRepository } from "./repositories/triggeredSendLogRepository";
import { UserRepository } from "./repositories/userRepository";
import { WorkflowExecutionRepository } from "./repositories/workflowExecutionRepository";
import { WorkflowRepository } from "./repositories/workflowRepository";

export interface RepositoryOptions {
  /** Seals provider credentials at rest (`aesGcmCipher(config.secretsKey)` in the apps). */
  secrets: SecretCipher;
}

/**
 * Every repository over one database handle. The concrete classes, so the app
 * keeps their full API; it also satisfies core's `Repositories`, which is
 * what `createServices` and `startWorkers` take.
 */
export function createRepositories(db: Database, { secrets }: RepositoryOptions) {
  const repositories = {
    aiProviders: new AiProviderRepository(db, secrets),
    apiKeys: new ApiKeyRepository(db),
    campaigns: new CampaignRepository(db),
    contacts: new ContactRepository(db),
    dashboard: new DashboardRepository(db),
    executions: new WorkflowExecutionRepository(db),
    projects: new ProjectRepository(db),
    providers: new EmailProviderRepository(db, secrets),
    savedRows: new SavedRowRepository(db),
    sendLogs: new TriggeredSendLogRepository(db),
    suppressions: new SuppressionRepository(db),
    templates: new EmailTemplateRepository(db),
    users: new UserRepository(db),
    workflows: new WorkflowRepository(db),
  };
  // Checked here, not at every call site: a repository that drifts from the
  // core interface fails this line.
  repositories satisfies Repositories;
  return repositories;
}

export type AppRepositories = ReturnType<typeof createRepositories>;
