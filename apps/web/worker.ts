import { CampaignRepository, EmailProviderRepository } from "@senlo/db";
import { EmailWorkerProcessor, createEmailWorker } from "@senlo/core/src/queue";

const campaignRepo = new CampaignRepository();
const providerRepo = new EmailProviderRepository();

const processor = new EmailWorkerProcessor(campaignRepo, providerRepo);

console.log("🚀 Starting Senlo Email Worker...");

const worker = createEmailWorker(processor);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});
