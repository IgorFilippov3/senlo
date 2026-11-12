// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, afterEach, vi } from "vitest";
import { UnrecoverableError } from "bullmq";
import type { Logger } from "../logger";
import { ServiceHooks } from "../hooks";
import type { SendMailResult } from "../ports";
import { EmailWorkerProcessor } from "../queue/worker";
import { MailerFactory } from "../services/mail/index";
import { isPermanentHttpStatus } from "../services/mail/keyCheck";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

describe("isPermanentHttpStatus", () => {
  it("is final for a 4xx except a timeout or a rate limit", () => {
    expect([400, 401, 403, 404, 422].every(isPermanentHttpStatus)).toBe(true);
    expect([408, 429, 500, 502, 503, 200].some(isPermanentHttpStatus)).toBe(false);
  });
});

describe("send worker: a failed send", () => {
  afterEach(() => vi.restoreAllMocks());

  function setup(result: SendMailResult, attempt: { attemptsMade: number; attempts: number }) {
    vi.spyOn(MailerFactory, "create").mockReturnValue({ send: async () => result } as never);
    const campaignRepo = { logEvent: vi.fn(async () => {}) };
    const logRepo = {
      findById: vi.fn(async () => ({ id: 9, status: "PENDING" })),
      update: vi.fn(async (_id: number, _data: Record<string, unknown>) => null),
    };
    const worker = new EmailWorkerProcessor(
      { appUrl: "https://app.test", linkSigningSecret: "s".repeat(32) } as never,
      campaignRepo as never,
      { findById: async () => ({ id: 7, type: "RESEND", config: {} }) } as never,
      {} as never,
      logRepo as never,
      { findSendBlock: async () => null } as never,
      silent,
      ServiceHooks.none,
    );
    const job = {
      id: "j1",
      attemptsMade: attempt.attemptsMade,
      opts: { attempts: attempt.attempts },
      data: {
        projectId: 1, campaignId: 5, contactId: 2, logId: 9, email: "r@x.test",
        from: "a@x.test", subject: "s", providerId: 7, html: "<p>hi</p>",
      },
    } as never;
    return { worker, job, campaignRepo, logRepo };
  }

  it("stops at once on a permanent refusal and marks the send failed with the provider's reason", async () => {
    const f = setup({ success: false, error: "API key is invalid", permanent: true }, { attemptsMade: 0, attempts: 3 });
    const error = await f.worker.processEmailJob(f.job).catch((e) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(f.logRepo.update).toHaveBeenCalledWith(9, { status: "FAILED", error: "API key is invalid" });
    expect(f.campaignRepo.logEvent.mock.calls.map((c: any) => c[0].type)).toEqual(["FAILED"]);
  });

  it("leaves a temporary failure to the retries: nothing written before the last attempt", async () => {
    const f = setup({ success: false, error: "Service unavailable" }, { attemptsMade: 0, attempts: 3 });
    const error = await f.worker.processEmailJob(f.job).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
    expect(f.logRepo.update).not.toHaveBeenCalled();
    expect(f.campaignRepo.logEvent).not.toHaveBeenCalled();
  });

  it("writes the failure on the last attempt", async () => {
    const f = setup({ success: false, error: "Service unavailable" }, { attemptsMade: 2, attempts: 3 });
    await f.worker.processEmailJob(f.job).catch(() => {});
    expect(f.logRepo.update).toHaveBeenCalledWith(9, { status: "FAILED", error: "Service unavailable" });
    expect(f.campaignRepo.logEvent.mock.calls.map((c: any) => c[0].type)).toEqual(["FAILED"]);
  });

  it("does not overwrite a status a webhook already set", async () => {
    const f = setup({ success: false, error: "x", permanent: true }, { attemptsMade: 0, attempts: 3 });
    f.logRepo.findById.mockResolvedValueOnce({ id: 9, status: "DELIVERED" });
    await f.worker.processEmailJob(f.job).catch(() => {});
    expect(f.logRepo.update).not.toHaveBeenCalled();
  });
});
