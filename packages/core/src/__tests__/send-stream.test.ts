// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, afterEach, vi } from "vitest";
import type { Logger } from "../logger";
import { ServiceHooks } from "../hooks";
import { EmailWorkerProcessor } from "../queue/worker";
import { MailerFactory } from "../services/mail/index";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

describe("send worker: stream", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes the job's stream to the mailer, and none for a job queued without it", async () => {
    const send = vi.fn(async (_options: { stream?: string }) => ({ success: true, messageId: "m1" }));
    vi.spyOn(MailerFactory, "create").mockReturnValue({ send } as never);
    const worker = new EmailWorkerProcessor(
      { appUrl: "https://app.test", linkSigningSecret: "s".repeat(32) } as never,
      { logEvent: vi.fn(async () => {}) } as never,
      { findById: async () => ({ id: 7, type: "GROUNDMAIL", config: { apiKey: "gm_x" } }) } as never,
      {} as never,
      { findById: vi.fn(async () => ({ id: 9, status: "PENDING" })), update: vi.fn(async () => null) } as never,
      { findSendBlock: async () => null } as never,
      silent,
      ServiceHooks.none,
    );
    const data = {
      projectId: 1, campaignId: 5, contactId: null, logId: 9, email: "r@x.test",
      from: "a@x.test", subject: "s", providerId: 7, html: "<p>hi</p>",
    };
    const job = (extra: object) => ({ id: "j1", attemptsMade: 0, opts: { attempts: 3 }, data: { ...data, ...extra } }) as never;

    await worker.processEmailJob(job({ stream: "lifecycle" }));
    await worker.processEmailJob(job({}));

    expect(send.mock.calls.map((c) => c[0].stream)).toEqual(["lifecycle", undefined]);
  });
});
