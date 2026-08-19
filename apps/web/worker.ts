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
  emailQueue,
  automationQueue,
} from "@senlo/core/src/queue";
import {
  AutomationService,
  TriggerService,
} from "@senlo/core";

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
  emailQueue,
);

const automationService = new AutomationService(
  workflowRepo,
  executionRepo,
  contactRepo,
  automationQueue,
  triggerService,
);

const processor = new EmailWorkerProcessor(
  campaignRepo,
  providerRepo,
  templateRepo,
  projectRepo,
  listRepo,
  emailQueue,
  logRepo,
  suppressionRepo,
);

const automationProcessor = new AutomationWorkerProcessor(automationService);

console.log("🚀 Starting Senlo Workers...");

const emailWorker = createEmailWorker(processor);
const campaignWorker = createCampaignWorker(processor);
const automationWorker = createAutomationWorker(automationProcessor);

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
