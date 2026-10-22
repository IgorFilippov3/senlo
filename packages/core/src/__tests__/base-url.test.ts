import { describe, it, expect, vi } from "vitest";
import { fixedBaseUrl, resolveProjectBaseUrl, type ResolveBaseUrl } from "../base-url";
import type { Campaign, Contact, EmailProvider, Project } from "../domain";
import type { EmailTemplate } from "../emailTemplate";
import type { Logger } from "../logger";
import { ServiceHooks } from "../hooks";
import { EmailWorkerProcessor } from "../queue/worker";
import { TriggerService } from "../services/triggerService";

const settings = {
  appUrl: "https://app.test",
  linkSigningSecret: "s".repeat(32),
  defaultFromEmail: "hello@app.test",
};
const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

// What managed would pass: project 1 has its own domain, the rest use the app.
const resolve: ResolveBaseUrl = async (projectId) => (projectId === 1 ? "https://mail.acme.test/" : settings.appUrl);

const project = { id: 1, userId: "alice", name: "Acme", providerId: 7, createdAt: new Date(), updatedAt: new Date() } as Project;
const template = { id: 9, projectId: 1, subject: "Hi", html: '<p><a href="https://example.com/offer">Offer</a></p>' } as EmailTemplate;
const campaign = { id: 5, projectId: 1, templateId: 9, listId: 3, type: "TRIGGERED", status: "DRAFT" } as Campaign;
const provider = { id: 7, type: "RESEND" } as EmailProvider;

describe("fixedBaseUrl / resolveProjectBaseUrl", () => {
  it("answers the app URL for every project, without a trailing slash", async () => {
    expect(await fixedBaseUrl("https://app.test/")(42)).toBe("https://app.test");
    expect(await resolveProjectBaseUrl(resolve, 1)).toBe("https://mail.acme.test");
  });
});

describe("a project's own base URL in its links", () => {
  it("triggered send: unsubscribe links and the job's base URL use the project's domain", async () => {
    const queue = { add: vi.fn(async () => ({ id: "j1" })) };
    const trigger = new TriggerService(
      { findById: async () => campaign } as never,
      { findById: async () => template } as never,
      { findById: async () => provider } as never,
      { findById: async () => project } as never,
      { create: async () => ({ id: 11 }) } as never,
      queue as never,
      settings,
      ServiceHooks.none,
      resolve,
    );
    await trigger.sendTriggeredEmail({ campaignId: 5, projectId: 1, to: "r@x.test" });
    const job = (queue.add.mock.calls[0] as any)[1];
    expect(job.baseUrl).toBe("https://mail.acme.test");
    expect(job.unsubscribePageUrl).toMatch(/^https:\/\/mail\.acme\.test\/unsubscribe\//);
    expect(job.unsubscribeOneClickUrl).toMatch(/^https:\/\/mail\.acme\.test\/api\/unsubscribe\//);
  });

  it("campaign send: jobs carry the domain, and the rendered mail tracks through it", async () => {
    const queue = { add: vi.fn(async () => ({})) };
    const worker = new EmailWorkerProcessor(
      settings as never,
      { findById: async () => campaign, update: async () => campaign } as never,
      { findById: async () => provider } as never,
      { findById: async () => template } as never,
      { findById: async () => project } as never,
      { getContacts: async () => [{ id: 2, email: "r@x.test", projectId: 1 } as Contact] } as never,
      queue as never,
      undefined,
      undefined,
      silent,
      ServiceHooks.none,
      resolve,
    );
    await worker.processCampaignJob({ data: { campaignId: 5 } } as never);
    const job = (queue.add.mock.calls[0] as any)[1];
    expect(job.baseUrl).toBe("https://mail.acme.test");
    expect(job.unsubscribePageUrl).toMatch(/^https:\/\/mail\.acme\.test\/unsubscribe\//);

    // Render through the template path (a job with `html` is sent as is, see
    // the 7.6 finding in the plan): the tracked links come from `job.baseUrl`.
    const { html: _prerendered, ...toRender } = job;
    const html: string = await (worker as any).buildMessageHtml(toRender);
    expect(html).toContain("https://mail.acme.test/api/t/c/");
    expect(html).toContain("https://mail.acme.test/api/t/o/");
    expect(html).not.toContain("https://app.test");
  });

  it("without a resolver, links stay on the app URL", async () => {
    const queue = { add: vi.fn(async () => ({ id: "j1" })) };
    const trigger = new TriggerService(
      { findById: async () => campaign } as never,
      { findById: async () => template } as never,
      { findById: async () => provider } as never,
      { findById: async () => project } as never,
      { create: async () => ({ id: 11 }) } as never,
      queue as never,
      settings,
    );
    await trigger.sendTriggeredEmail({ campaignId: 5, projectId: 1, to: "r@x.test" });
    expect((queue.add.mock.calls[0] as any)[1].unsubscribePageUrl).toMatch(/^https:\/\/app\.test\/unsubscribe\//);
  });
});
