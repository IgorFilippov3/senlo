import {
  CampaignRepository,
  EmailProviderRepository,
  TriggeredSendLogRepository,
  SuppressionRepository,
  EmailTemplateRepository,
  ProjectRepository,
  RecipientListRepository,
  db,
} from "@senlo/db";
import {
  EmailWorkerProcessor,
  createEmailWorker,
  createCampaignWorker,
  emailQueue,
} from "@senlo/core/src/queue";

const campaignRepo = new CampaignRepository(db);
const providerRepo = new EmailProviderRepository(db);
const logRepo = new TriggeredSendLogRepository(db);
const suppressionRepo = new SuppressionRepository(db);
const templateRepo = new EmailTemplateRepository(db);
const projectRepo = new ProjectRepository(db);
const listRepo = new RecipientListRepository(db);

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

console.log("🚀 Starting Senlo Workers...");

const emailWorker = createEmailWorker(processor);
const campaignWorker = createCampaignWorker(processor);

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

process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  await Promise.all([emailWorker.close(), campaignWorker.close()]);
  process.exit(0);
});
