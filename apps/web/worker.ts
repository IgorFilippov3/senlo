import {
  CampaignRepository,
  EmailProviderRepository,
  TriggeredSendLogRepository,
  SuppressionRepository,
  EmailTemplateRepository,
  ProjectRepository,
  RecipientListRepository,
  WorkflowRepository,
  WorkflowExecutionRepository,
  ContactRepository,
  db,
} from "@senlo/db";
import {
  EmailWorkerProcessor,
  AutomationWorkerProcessor,
  createEmailWorker,
  createCampaignWorker,
  createAutomationWorker,
  createQueues,
  createRedisConnection,
} from "@senlo/core/queue";
import {
  AutomationService,
  ConfigError,
  TriggerService,
  loadSenloConfig,
  mailSettings,
  type SenloConfig,
} from "@senlo/core";

// Checked before anything connects: a broken config stops the worker with
// the full list of what to fix, instead of failing on the first job.
let config: SenloConfig;
try {
  config = loadSenloConfig(process.env);
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
}

const connection = {
  connection: createRedisConnection(config.redisUrl),
  prefix: config.queuePrefix,
};
const queues = createQueues(connection);
const settings = mailSettings(config);

const campaignRepo = new CampaignRepository(db);
const providerRepo = new EmailProviderRepository(db);
const logRepo = new TriggeredSendLogRepository(db);
const suppressionRepo = new SuppressionRepository(db);
const templateRepo = new EmailTemplateRepository(db);
const projectRepo = new ProjectRepository(db);
const listRepo = new RecipientListRepository(db);
const workflowRepo = new WorkflowRepository(db);
const executionRepo = new WorkflowExecutionRepository(db);
const contactRepo = new ContactRepository(db);

const triggerService = new TriggerService(
  campaignRepo,
  templateRepo,
  providerRepo,
  projectRepo,
  logRepo,
  queues.email,
  settings,
);

const automationService = new AutomationService(
  workflowRepo,
  executionRepo,
  contactRepo,
  queues.automation,
  triggerService,
);

const processor = new EmailWorkerProcessor(
  settings,
  campaignRepo,
  providerRepo,
  templateRepo,
  projectRepo,
  listRepo,
  queues.email,
  logRepo,
  suppressionRepo,
);

const automationProcessor = new AutomationWorkerProcessor(automationService, settings);

console.log("🚀 Starting Senlo Workers...");

const emailWorker = createEmailWorker(processor, connection);
const campaignWorker = createCampaignWorker(processor, connection);
const automationWorker = createAutomationWorker(automationProcessor, connection);

const setupLogging = (worker: any, name: string) => {
  worker.on("completed", (job: any) => {
    console.log(`✅ [${name}] Job ${job.id} completed`);
  });

  worker.on("failed", (job: any, err: Error) => {
    console.error(`❌ [${name}] Job ${job?.id} failed:`, err);
  });
};

setupLogging(emailWorker, "Email");
setupLogging(campaignWorker, "Campaign");
setupLogging(automationWorker, "Automation");

process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  await Promise.all([
    emailWorker.close(),
    campaignWorker.close(),
    automationWorker.close(),
  ]);
  process.exit(0);
});
