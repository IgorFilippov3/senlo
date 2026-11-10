import { describe, it, expect, vi } from "vitest";
import type { Campaign, EmailProvider, Project, TriggeredSendLog } from "../domain";
import type { EmailTemplate } from "../emailTemplate";
import { QuotaExceededError } from "../errors";
import { ServiceHooks } from "../hooks";
import { TriggerService } from "../services/triggerService";

type LogInput = Omit<TriggeredSendLog, "id" | "sentAt">;

function setup({ quotaLeft = true } = {}) {
  const rows: Array<TriggeredSendLog & { dedupeKey?: string }> = [];
  const add = (data: LogInput, dedupeKey?: string) => {
    const log = { ...data, id: rows.length + 1, sentAt: new Date(), dedupeKey };
    rows.push(log);
    return log;
  };
  const logs = {
    create: vi.fn(async (data: LogInput) => add(data)),
    createOnce: vi.fn(async (data: LogInput, dedupeKey: string) => {
      const existing = rows.find((r) => r.dedupeKey === dedupeKey);
      return existing ? { log: existing, created: false } : { log: add(data, dedupeKey), created: true };
    }),
    findByDedupeKey: vi.fn(async (key: string) => rows.find((r) => r.dedupeKey === key) ?? null),
  };
  const queue = { add: vi.fn(async (_name: string, _data: unknown, opts?: { jobId?: string }) => ({ id: opts?.jobId ?? "random" })) };
  const quota = {
    check: vi.fn(async () => (quotaLeft ? { allowed: true as const } : { allowed: false as const, reason: "Out of sends" })),
  };
  const trigger = new TriggerService(
    { findById: async () => ({ id: 5, projectId: 1, type: "TRIGGERED", templateId: 9 }) as Campaign } as never,
    { findById: async () => ({ id: 9, projectId: 1, subject: "Hi" }) as EmailTemplate } as never,
    { findById: async () => ({ id: 7, type: "RESEND" }) as EmailProvider } as never,
    { findById: async () => ({ id: 1, name: "P", providerId: 7 }) as Project } as never,
    logs as never,
    queue as never,
    { linkSigningSecret: "s".repeat(32), defaultFromEmail: "a@x.test", appUrl: "https://app.test" },
    new ServiceHooks({ quota } as never),
  );
  return { trigger, logs, queue, rows, quota };
}

const send = { campaignId: 5, projectId: 1, to: "r@x.test" };

describe("deduplicated triggered sends", () => {
  it("a send without a key always queues, with one job per log row", async () => {
    const { trigger, queue, logs } = setup();
    await trigger.sendTriggeredEmail(send);
    await trigger.sendTriggeredEmail(send);
    expect(logs.create).toHaveBeenCalledTimes(2);
    expect(queue.add.mock.calls.map((c) => c[2])).toEqual([{ jobId: "triggered-log-1" }, { jobId: "triggered-log-2" }]);
  });

  it("a repeat with the key while the email is PENDING reuses the row and the job id", async () => {
    const { trigger, queue, rows } = setup();
    const first = await trigger.sendTriggeredEmail({ ...send, dedupeKey: "wf-1-mail" });
    const again = await trigger.sendTriggeredEmail({ ...send, dedupeKey: "wf-1-mail" });

    expect(rows).toHaveLength(1);
    expect(first).toMatchObject({ logId: 1, duplicate: false });
    expect(again).toMatchObject({ logId: 1, duplicate: true });
    // Same job id twice: BullMQ keeps one job.
    expect(queue.add.mock.calls.map((c) => c[2])).toEqual([{ jobId: "triggered-log-1" }, { jobId: "triggered-log-1" }]);
  });

  it("a repeat after the email left the queue sends nothing", async () => {
    const { trigger, queue, rows } = setup();
    await trigger.sendTriggeredEmail({ ...send, dedupeKey: "wf-1-mail" });
    rows[0].status = "SUCCESS";

    const again = await trigger.sendTriggeredEmail({ ...send, dedupeKey: "wf-1-mail" });

    expect(again).toMatchObject({ logId: 1, duplicate: true, jobId: undefined });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it("a repeat is not refused by the plan: the first send was already allowed", async () => {
    const { trigger, quota, queue } = setup();
    await trigger.sendTriggeredEmail({ ...send, dedupeKey: "wf-1-mail" });
    quota.check.mockResolvedValue({ allowed: false, reason: "Out of sends" } as never);

    await expect(trigger.sendTriggeredEmail({ ...send, dedupeKey: "wf-1-mail" })).resolves.toMatchObject({ duplicate: true });
    await expect(trigger.sendTriggeredEmail({ ...send, dedupeKey: "wf-2-mail" })).rejects.toThrow(QuotaExceededError);
    expect(queue.add).toHaveBeenCalledTimes(2);
  });
});
