import { describe, it, expect, vi } from "vitest";
import type { EmailTemplate } from "../emailTemplate";
import type { Logger } from "../logger";
import { ServiceHooks } from "../hooks";
import { EmailWorkerProcessor } from "../queue/worker";
import { MailerFactory } from "../services/mail/index";

// Two send-path gaps found while writing the public docs (2026-11-03):
// - the worker rendered every designed template without the recipient's data,
//   so loops rendered nothing and conditions saw empty values on real sends;
// - unsubscribing a contact only flagged the contact, and the worker checked
//   the suppression list alone, so the contact kept getting mail.

const settings = {
  appUrl: "https://app.test",
  linkSigningSecret: "s".repeat(32),
  defaultFromEmail: "hello@app.test",
};
const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

const heading = (id: string, text: string, condition?: object) => ({
  id,
  type: "heading",
  data: { text },
  ...(condition ? { condition } : {}),
});

const designed = {
  id: 9,
  projectId: 1,
  subject: "Hi",
  html: "",
  designJson: {
    version: 4,
    settings: { contentWidth: 600 },
    rows: [
      {
        id: "lines",
        type: "row",
        loop: { variable: "items", alias: "item" },
        settings: {},
        columns: [{ id: "c1", width: 100, blocks: [heading("h1", "Line {{item.title}}")] }],
      },
      {
        id: "vip",
        type: "row",
        settings: {},
        columns: [
          {
            id: "c2",
            width: 100,
            blocks: [
              heading("h2", "VIP perk", { variable: "plan", operator: "equals", value: "pro" }),
              heading("h3", "Upgrade to Pro", { variable: "plan", operator: "not_equals", value: "pro" }),
            ],
          },
        ],
      },
    ],
  },
} as unknown as EmailTemplate;

function worker(suppressions?: object) {
  return new EmailWorkerProcessor(
    settings as never,
    { logEvent: vi.fn(async () => {}) } as never,
    { findById: async () => ({ id: 7, type: "RESEND", config: {} }) } as never,
    { findById: async () => designed } as never,
    { update: vi.fn(async () => {}) } as never,
    suppressions as never,
    silent,
    ServiceHooks.none,
  );
}

const job = (data: Record<string, unknown>) => ({
  projectId: 1,
  campaignId: 5,
  contactId: null,
  logId: 11,
  email: "r@x.test",
  from: "a@x.test",
  subject: "s",
  providerId: 7,
  templateId: 9,
  baseUrl: "https://app.test",
  renderData: { custom: data, contact: { email: "r@x.test", ...data } },
});

describe("a designed template is rendered with the recipient's data", () => {
  it("repeats a looped row for each item", async () => {
    const html: string = await (worker() as any).buildMessageHtml(
      job({ items: [{ title: "Mug" }, { title: "Tea" }] }),
    );
    expect(html).toContain("Line Mug");
    expect(html).toContain("Line Tea");
  });

  it("evaluates conditions against this recipient, not the previous one", async () => {
    const w = worker();
    const pro: string = await (w as any).buildMessageHtml(job({ plan: "pro", items: [] }));
    const free: string = await (w as any).buildMessageHtml(job({ plan: "free", items: [] }));
    expect(pro).toContain("VIP perk");
    expect(pro).not.toContain("Upgrade to Pro");
    expect(free).toContain("Upgrade to Pro");
    expect(free).not.toContain("VIP perk");
  });
});

describe("the worker never mails a blocked recipient", () => {
  it("skips an unsubscribed contact and records the reason", async () => {
    const send = vi.fn(async () => ({ success: true, messageId: "m-1" }));
    vi.spyOn(MailerFactory, "create").mockReturnValue({ send } as never);
    const findSendBlock = vi.fn(async () => ({ reason: "UNSUBSCRIBE" as const }));
    const w = worker({ findSendBlock });

    await w.processEmailJob({ id: "j1", data: job({}) } as never);

    expect(findSendBlock).toHaveBeenCalledWith(1, "r@x.test");
    expect(send).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
