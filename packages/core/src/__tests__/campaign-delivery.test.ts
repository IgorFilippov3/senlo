import { describe, it, expect, vi } from "vitest";
import type { Logger } from "../logger";
import { ServiceHooks } from "../hooks";
import { EmailWorkerProcessor } from "../queue/worker";
import { MailerFactory } from "../services/mail/index";

// 7.5: the worker wrote DELIVERED right after SENT, before any provider had
// reported delivery, so campaign "delivered" always equalled "sent".

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

describe("send worker: campaign events", () => {
  it("records SENT only; DELIVERED is left to the provider's webhook", async () => {
    vi.spyOn(MailerFactory, "create").mockReturnValue({
      send: async () => ({ success: true, messageId: "m-1" }),
    } as never);
    const campaignRepo = { logEvent: vi.fn(async () => {}) };
    const worker = new EmailWorkerProcessor(
      { appUrl: "https://app.test", linkSigningSecret: "s".repeat(32) } as never,
      campaignRepo as never,
      { findById: async () => ({ id: 7, type: "RESEND", config: {} }) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      silent,
      ServiceHooks.none,
    );

    await worker.processEmailJob({
      id: "j1",
      data: {
        projectId: 1,
        campaignId: 5,
        contactId: 2,
        email: "r@x.test",
        from: "a@x.test",
        subject: "s",
        providerId: 7,
        html: "<p>hi</p>",
      },
    } as never);

    expect(campaignRepo.logEvent.mock.calls.map((c: any) => c[0].type)).toEqual(["SENT"]);
    vi.restoreAllMocks();
  });
});
