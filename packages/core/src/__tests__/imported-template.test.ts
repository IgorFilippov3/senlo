import { describe, it, expect, vi } from "vitest";
import type { Campaign, Contact, EmailProvider, Project } from "../domain";
import type { EmailTemplate } from "../emailTemplate";
import type { Logger } from "../logger";
import { ServiceHooks } from "../hooks";
import { EmailWorkerProcessor } from "../queue/worker";
import { TriggerService } from "../services/triggerService";

// 7.6: a template imported as HTML (no designJson) used to be queued with its
// HTML and sent as is: merge tags, tracking and the unsubscribe tag untouched.

const settings = {
  appUrl: "https://app.test",
  linkSigningSecret: "s".repeat(32),
  defaultFromEmail: "hello@app.test",
};
const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

const project = { id: 1, userId: "alice", name: "Acme", providerId: 7, createdAt: new Date(), updatedAt: new Date() } as Project;
const imported = {
  id: 9,
  projectId: 1,
  subject: "Hi",
  designJson: null,
  html:
    '<html><body><p>Hello {{contact.email}}</p>' +
    '<a href="https://example.com/offer">Offer</a>' +
    '<a href="{{unsubscribe_url}}">Unsubscribe</a></body></html>',
} as unknown as EmailTemplate;
const campaign = { id: 5, projectId: 1, templateId: 9, listId: 3, type: "TRIGGERED", status: "DRAFT" } as Campaign;
const provider = { id: 7, type: "RESEND" } as EmailProvider;

function worker(queue: { add: ReturnType<typeof vi.fn> }) {
  return new EmailWorkerProcessor(
    settings as never,
    { findById: async () => campaign, update: async () => campaign } as never,
    { findById: async () => provider } as never,
    { findById: async () => imported } as never,
    { findById: async () => project } as never,
    { getContacts: async () => [{ id: 2, email: "r@x.test", projectId: 1 } as Contact] } as never,
    queue as never,
    undefined,
    undefined,
    silent,
    ServiceHooks.none,
  );
}

function expectPersonalized(html: string, job: { unsubscribePageUrl: string }) {
  expect(html).toContain("Hello r@x.test");
  expect(html).not.toContain("{{");
  expect(html).toContain(`href="${job.unsubscribePageUrl}"`);
  expect(html).toContain("https://app.test/api/t/c/");
  expect(html).not.toContain('href="https://example.com/offer"');
  expect(html).toContain("https://app.test/api/t/o/");
}

describe("imported HTML templates are personalized like designed ones", () => {
  it("campaign send: queued by templateId, rendered with merge tags, tracking and unsubscribe", async () => {
    const queue = { add: vi.fn(async () => ({})) };
    const w = worker(queue);
    await w.processCampaignJob({ data: { campaignId: 5 } } as never);
    const job = (queue.add.mock.calls[0] as any)[1];
    expect(job.html).toBeUndefined();
    expect(job.templateId).toBe(9);
    expectPersonalized(await (w as any).buildMessageHtml(job), job);
  });

  it("triggered send: queued by templateId, rendered the same way", async () => {
    const queue = { add: vi.fn(async () => ({ id: "j1" })) };
    const trigger = new TriggerService(
      { findById: async () => campaign } as never,
      { findById: async () => imported } as never,
      { findById: async () => provider } as never,
      { findById: async () => project } as never,
      { create: async () => ({ id: 11 }) } as never,
      queue as never,
      settings,
    );
    await trigger.sendTriggeredEmail({ campaignId: 5, projectId: 1, to: "r@x.test" });
    const job = (queue.add.mock.calls[0] as any)[1];
    expect(job.html).toBeUndefined();
    expect(job.templateId).toBe(9);
    expectPersonalized(await (worker({ add: vi.fn() }) as any).buildMessageHtml(job), job);
  });

  it("a job that carries html (the test send) is still sent as is", async () => {
    const w = worker({ add: vi.fn() });
    const html = "<p>{{contact.email}}</p>";
    expect(await (w as any).buildMessageHtml({ html, campaignId: 0, email: "r@x.test" })).toBe(html);
  });
});
