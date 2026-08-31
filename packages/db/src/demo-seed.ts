// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./client";
import {
  apiKeys,
  campaignEvents,
  campaigns,
  contacts,
  emailProviders,
  emailTemplates,
  projects,
  triggeredSendLogs,
  workflowEdges,
  workflowExecutions,
  workflowNodes,
  workflows,
  workflowStepExecutions,
} from "./schema";
import {
  ORDER_CONFIRMATION_TEMPLATE_DESIGN_JSON,
  ORDER_CONFIRMATION_TEMPLATE_HTML,
} from "./seeds/order-confirmation-template";
import {
  PERSONALIZATION_TEMPLATE_DESIGN_JSON,
  PERSONALIZATION_TEMPLATE_HTML,
} from "./seeds/personalization-template";
import {
  TRANSACTIONAL_TEMPLATE_DESIGN_JSON,
  TRANSACTIONAL_TEMPLATE_HTML,
} from "./seeds/transactional-template";
import {
  WELCOME_TO_SENLO_TEMPLATE_DESIGN_JSON,
  WELCOME_TO_SENLO_TEMPLATE_HTML,
} from "./seeds/welcome-to-senlo-template";

/**
 * Name of the project this seed creates. Used as the marker for "demo data
 * already present" — see `seed-demo.ts`.
 */
export const DEMO_PROJECT_NAME = "Acme SaaS";

/**
 * Deterministic PRNG (mulberry32). The demo data feeds screenshots, so the
 * same seed must produce the same numbers on every machine and every run —
 * otherwise a re-shot screenshot silently disagrees with the one next to it.
 */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260831);

function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

/** `days` ago, at a plausible hour of the working day. */
function daysAgo(days: number, hour?: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(
    hour ?? 8 + Math.floor(random() * 11),
    Math.floor(random() * 60),
    Math.floor(random() * 60),
    0,
  );
  return date;
}

function apiKeyValue(): string {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i++) {
    value += characters.charAt(Math.floor(random() * characters.length));
  }
  return `snl_${value}`;
}

const DEMO_CONTACTS: Array<{
  email: string;
  name: string;
  locale: string;
  plan: string;
  tags: string[];
  unsubscribed?: boolean;
}> = [
  { email: "amelia.hart@northwind.dev", name: "Amelia Hart", locale: "en", plan: "pro", tags: ["activated", "onboarded"] },
  { email: "tomas.vidal@lumaworks.io", name: "Tomás Vidal", locale: "es", plan: "trial", tags: ["trial"] },
  { email: "j.lindqvist@brightloop.se", name: "Johan Lindqvist", locale: "en", plan: "pro", tags: ["activated"] },
  { email: "marie.dubois@atelier.fr", name: "Marie Dubois", locale: "fr", plan: "starter", tags: ["onboarded"] },
  { email: "k.schneider@hansa-it.de", name: "Katrin Schneider", locale: "de", plan: "pro", tags: ["activated", "champion"] },
  { email: "ravi.menon@kitehq.com", name: "Ravi Menon", locale: "en", plan: "trial", tags: ["trial"] },
  { email: "sofia.rossi@bottega.it", name: "Sofia Rossi", locale: "en", plan: "starter", tags: ["onboarded"] },
  { email: "d.okafor@lagostech.ng", name: "Daniel Okafor", locale: "en", plan: "pro", tags: ["activated"] },
  { email: "elise.moreau@cartier-web.fr", name: "Élise Moreau", locale: "fr", plan: "trial", tags: ["trial"] },
  { email: "m.bergmann@stellar.de", name: "Max Bergmann", locale: "de", plan: "starter", tags: [] },
  { email: "yuki.tanaka@shibuya-labs.jp", name: "Yuki Tanaka", locale: "en", plan: "pro", tags: ["activated"] },
  { email: "carla.mendes@vialogic.br", name: "Carla Mendes", locale: "es", plan: "trial", tags: ["trial"] },
  { email: "peter.novak@formix.cz", name: "Petr Novák", locale: "en", plan: "starter", tags: ["onboarded"] },
  { email: "hannah.byrne@dublinsix.ie", name: "Hannah Byrne", locale: "en", plan: "pro", tags: ["activated", "champion"] },
  { email: "l.fernandez@sandia.mx", name: "Lucía Fernández", locale: "es", plan: "trial", tags: ["trial"] },
  { email: "o.karlsson@fjord.no", name: "Olav Karlsson", locale: "en", plan: "starter", tags: [] },
  { email: "n.almeida@porto-dev.pt", name: "Nuno Almeida", locale: "en", plan: "pro", tags: ["activated"] },
  { email: "s.petrov@arcline.bg", name: "Stefan Petrov", locale: "en", plan: "trial", tags: ["trial"] },
  { email: "greta.olsen@nordkit.dk", name: "Greta Olsen", locale: "en", plan: "starter", tags: ["onboarded"] },
  { email: "ahmed.said@nileworks.eg", name: "Ahmed Said", locale: "en", plan: "pro", tags: ["activated"] },
  { email: "julia.kowalski@wislatech.pl", name: "Julia Kowalski", locale: "en", plan: "trial", tags: ["trial"] },
  { email: "b.laurent@quaidorsay.fr", name: "Bastien Laurent", locale: "fr", plan: "starter", tags: [] },
  { email: "old.address@example.com", name: "Former Customer", locale: "en", plan: "churned", tags: [], unsubscribed: true },
  { email: "bounced@invalid-domain.test", name: "Unknown Recipient", locale: "en", plan: "trial", tags: [], unsubscribed: true },
];

const CLICK_TARGETS = [
  "https://acme.example/dashboard",
  "https://acme.example/docs/getting-started",
  "https://acme.example/pricing",
  "https://acme.example/invite-team",
];

/**
 * Fills a project with a believable working setup: templates, triggers,
 * contacts, two automations, and 30 days of delivery history.
 *
 * This is NOT the seed new users get on registration (see `user-seed.ts`).
 * It exists for screenshots and for the public demo instance, and it invents
 * analytics that never happened — do not run it on an instance where someone
 * might read those numbers as their own.
 */
export async function seedDemoData(userId: string) {
  // 1. Provider — so the Providers page and the project both look configured.
  const [provider] = await db
    .insert(emailProviders)
    .values({
      userId,
      name: "Resend (demo)",
      type: "RESEND",
      config: { apiKey: "re_demo_key_not_a_real_credential" },
      isActive: true,
    })
    .returning();

  // 2. Project
  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: DEMO_PROJECT_NAME,
      description: "Product emails for the Acme web app — trials, onboarding and receipts.",
      providerId: provider.id,
    })
    .returning();

  // 3. Templates
  const insertedTemplates = await db
    .insert(emailTemplates)
    .values([
      {
        projectId: project.id,
        name: "Welcome email",
        subject: "Welcome to Acme, {{contact.name}}",
        html: WELCOME_TO_SENLO_TEMPLATE_HTML,
        designJson: WELCOME_TO_SENLO_TEMPLATE_DESIGN_JSON,
        status: "published",
      },
      {
        projectId: project.id,
        name: "Order confirmation",
        subject: "Your order {{order.number}} is confirmed",
        html: ORDER_CONFIRMATION_TEMPLATE_HTML,
        designJson: ORDER_CONFIRMATION_TEMPLATE_DESIGN_JSON,
        status: "published",
      },
      {
        projectId: project.id,
        name: "Trial ending reminder",
        subject: "{{contact.name}}, your trial ends in 3 days",
        html: PERSONALIZATION_TEMPLATE_HTML,
        designJson: PERSONALIZATION_TEMPLATE_DESIGN_JSON,
        status: "published",
      },
      {
        projectId: project.id,
        name: "Password reset",
        subject: "Reset your Acme password",
        html: TRANSACTIONAL_TEMPLATE_HTML,
        designJson: TRANSACTIONAL_TEMPLATE_DESIGN_JSON,
        status: "published",
      },
      {
        projectId: project.id,
        name: "Feature announcement (draft)",
        subject: "New in Acme: scheduled reports",
        html: PERSONALIZATION_TEMPLATE_HTML,
        designJson: PERSONALIZATION_TEMPLATE_DESIGN_JSON,
        status: "draft",
      },
    ])
    .returning();

  const templateByName = new Map(insertedTemplates.map((t) => [t.name, t]));

  // 4. Triggers (triggered campaigns) — what Action nodes point at.
  const insertedCampaigns = await db
    .insert(campaigns)
    .values([
      {
        projectId: project.id,
        templateId: templateByName.get("Welcome email")!.id,
        name: "Welcome email",
        description: "Sent the moment a trial account is created.",
        type: "TRIGGERED",
        status: "COMPLETED",
        fromName: "Acme",
        fromEmail: "hello@acme.example",
        replyTo: "support@acme.example",
        variablesSchema: { plan: "string", workspace_name: "string" },
      },
      {
        projectId: project.id,
        templateId: templateByName.get("Order confirmation")!.id,
        name: "Order confirmation",
        description: "Receipt for a completed purchase.",
        type: "TRIGGERED",
        status: "COMPLETED",
        fromName: "Acme Billing",
        fromEmail: "billing@acme.example",
        variablesSchema: { order: "object", total: "number" },
      },
      {
        projectId: project.id,
        templateId: templateByName.get("Trial ending reminder")!.id,
        name: "Trial ending reminder",
        description: "Nudge for trials with no activity on day 3.",
        type: "TRIGGERED",
        status: "COMPLETED",
        fromName: "Acme",
        fromEmail: "hello@acme.example",
        variablesSchema: { days_left: "number", plan: "string" },
      },
      {
        projectId: project.id,
        templateId: templateByName.get("Password reset")!.id,
        name: "Password reset",
        description: "Transactional, triggered from the auth service.",
        type: "TRIGGERED",
        status: "COMPLETED",
        fromName: "Acme Security",
        fromEmail: "no-reply@acme.example",
        variablesSchema: { reset_url: "string", expires_in: "string" },
      },
    ])
    .returning();

  const campaignByName = new Map(insertedCampaigns.map((c) => [c.name, c]));

  // 5. Contacts
  const insertedContacts = await db
    .insert(contacts)
    .values(
      DEMO_CONTACTS.map((contact, index) => ({
        projectId: project.id,
        email: contact.email,
        name: contact.name,
        locale: contact.locale,
        meta: {
          plan: contact.plan,
          tags: contact.tags,
          source: pick(["website", "product_hunt", "referral", "docs"]),
        },
        unsubscribed: contact.unsubscribed ?? false,
        // Always after createdAt below — an unsubscribe that predates the
        // signup reads as broken data the moment anyone sorts the table.
        unsubscribedAt: contact.unsubscribed ? daysAgo(2) : null,
        createdAt: daysAgo(29 - Math.floor(index * 1.1)),
      })),
    )
    .returning();

  // 6. API key
  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      projectId: project.id,
      name: "Production backend",
      key: apiKeyValue(),
      lastUsedAt: daysAgo(0, 9),
    })
    .returning();

  // 7. Automations
  const onboarding = await seedOnboardingWorkflow(project.id, campaignByName);
  await seedWinbackWorkflow(project.id, campaignByName);
  await seedReceiptWorkflow(project.id, campaignByName);

  // 8. History: node-level stats and dashboard analytics
  await seedWorkflowRuns(onboarding, insertedContacts);
  await seedDeliveryHistory(insertedCampaigns, insertedContacts);

  return { project, apiKey, contactCount: insertedContacts.length };
}

type SeededWorkflow = {
  id: number;
  nodeIds: {
    trigger: string;
    welcome: string;
    wait: string;
    check: string;
    tag: string;
    exitActivated: string;
    nudge: string;
    waitAgain: string;
    exitCold: string;
  };
};

/**
 * The flagship automation: welcome → wait → ask the product whether the user
 * activated → tag them, or nudge them once more. Nine nodes, one branch —
 * enough to show what the builder does without turning into noise.
 */
async function seedOnboardingWorkflow(
  projectId: number,
  campaignByName: Map<string, { id: number }>,
): Promise<SeededWorkflow> {
  const [workflow] = await db
    .insert(workflows)
    .values({
      projectId,
      name: "Trial onboarding",
      description: "Welcome new trials, then branch on whether they activated.",
      status: "ACTIVE",
    })
    .returning();

  const id = (suffix: string) => `wf${workflow.id}-${suffix}`;
  const nodeIds = {
    trigger: id("trigger"),
    welcome: id("welcome"),
    wait: id("wait"),
    check: id("check"),
    tag: id("tag"),
    exitActivated: id("exit-activated"),
    nudge: id("nudge"),
    waitAgain: id("wait-again"),
    exitCold: id("exit-cold"),
  };

  await db.insert(workflowNodes).values([
    {
      id: nodeIds.trigger,
      workflowId: workflow.id,
      type: "trigger",
      data: { event: "contact_added", label: "Signed up for a trial" },
      positionX: 400,
      positionY: 0,
    },
    {
      id: nodeIds.welcome,
      workflowId: workflow.id,
      type: "action",
      data: {
        triggerId: campaignByName.get("Welcome email")!.id,
        label: "Send welcome email",
      },
      positionX: 400,
      positionY: 170,
    },
    {
      id: nodeIds.wait,
      workflowId: workflow.id,
      type: "delay",
      data: { duration: 2, unit: "days" },
      positionX: 400,
      positionY: 340,
    },
    {
      id: nodeIds.check,
      workflowId: workflow.id,
      type: "condition",
      data: {
        url: "https://api.acme.example/v1/activation-check",
        label: "Created a first report?",
      },
      positionX: 400,
      positionY: 510,
    },
    {
      id: nodeIds.tag,
      workflowId: workflow.id,
      type: "update_contact",
      data: {
        label: "Tag as activated",
        updates: { plan: "pro", tags: ["activated"] },
      },
      positionX: 700,
      positionY: 700,
    },
    {
      id: nodeIds.exitActivated,
      workflowId: workflow.id,
      type: "exit",
      data: { label: "Activated" },
      positionX: 700,
      positionY: 870,
    },
    {
      id: nodeIds.nudge,
      workflowId: workflow.id,
      type: "action",
      data: {
        triggerId: campaignByName.get("Trial ending reminder")!.id,
        label: "Send trial ending reminder",
      },
      positionX: 100,
      positionY: 700,
    },
    {
      id: nodeIds.waitAgain,
      workflowId: workflow.id,
      type: "delay",
      data: { duration: 3, unit: "days" },
      positionX: 100,
      positionY: 870,
    },
    {
      id: nodeIds.exitCold,
      workflowId: workflow.id,
      type: "exit",
      data: { label: "Did not activate" },
      positionX: 100,
      positionY: 1040,
    },
  ]);

  await db.insert(workflowEdges).values([
    { id: `${nodeIds.trigger}->${nodeIds.welcome}`, workflowId: workflow.id, sourceNodeId: nodeIds.trigger, targetNodeId: nodeIds.welcome, sourceHandle: null },
    { id: `${nodeIds.welcome}->${nodeIds.wait}`, workflowId: workflow.id, sourceNodeId: nodeIds.welcome, targetNodeId: nodeIds.wait, sourceHandle: null },
    { id: `${nodeIds.wait}->${nodeIds.check}`, workflowId: workflow.id, sourceNodeId: nodeIds.wait, targetNodeId: nodeIds.check, sourceHandle: null },
    { id: `${nodeIds.check}->${nodeIds.tag}`, workflowId: workflow.id, sourceNodeId: nodeIds.check, targetNodeId: nodeIds.tag, sourceHandle: "yes" },
    { id: `${nodeIds.tag}->${nodeIds.exitActivated}`, workflowId: workflow.id, sourceNodeId: nodeIds.tag, targetNodeId: nodeIds.exitActivated, sourceHandle: null },
    { id: `${nodeIds.check}->${nodeIds.nudge}`, workflowId: workflow.id, sourceNodeId: nodeIds.check, targetNodeId: nodeIds.nudge, sourceHandle: "no" },
    { id: `${nodeIds.nudge}->${nodeIds.waitAgain}`, workflowId: workflow.id, sourceNodeId: nodeIds.nudge, targetNodeId: nodeIds.waitAgain, sourceHandle: null },
    { id: `${nodeIds.waitAgain}->${nodeIds.exitCold}`, workflowId: workflow.id, sourceNodeId: nodeIds.waitAgain, targetNodeId: nodeIds.exitCold, sourceHandle: null },
  ]);

  return { id: workflow.id, nodeIds };
}

/** A paused automation, so the list is not a single row. */
async function seedWinbackWorkflow(
  projectId: number,
  campaignByName: Map<string, { id: number }>,
) {
  const [workflow] = await db
    .insert(workflows)
    .values({
      projectId,
      name: "Win-back after cancellation",
      description: "Paused while we rewrite the offer.",
      status: "PAUSED",
    })
    .returning();

  const id = (suffix: string) => `wf${workflow.id}-${suffix}`;

  await db.insert(workflowNodes).values([
    { id: id("trigger"), workflowId: workflow.id, type: "trigger", data: { event: "tag_added", label: "Tagged: cancelled" }, positionX: 400, positionY: 0 },
    { id: id("wait"), workflowId: workflow.id, type: "delay", data: { duration: 14, unit: "days" }, positionX: 400, positionY: 170 },
    { id: id("offer"), workflowId: workflow.id, type: "action", data: { triggerId: campaignByName.get("Trial ending reminder")!.id, label: "Send win-back offer" }, positionX: 400, positionY: 340 },
    { id: id("exit"), workflowId: workflow.id, type: "exit", data: { label: "Done" }, positionX: 400, positionY: 510 },
  ]);

  await db.insert(workflowEdges).values([
    { id: `${id("trigger")}->${id("wait")}`, workflowId: workflow.id, sourceNodeId: id("trigger"), targetNodeId: id("wait"), sourceHandle: null },
    { id: `${id("wait")}->${id("offer")}`, workflowId: workflow.id, sourceNodeId: id("wait"), targetNodeId: id("offer"), sourceHandle: null },
    { id: `${id("offer")}->${id("exit")}`, workflowId: workflow.id, sourceNodeId: id("offer"), targetNodeId: id("exit"), sourceHandle: null },
  ]);
}

/** A draft, mid-build — the state most automations actually live in. */
async function seedReceiptWorkflow(
  projectId: number,
  campaignByName: Map<string, { id: number }>,
) {
  const [workflow] = await db
    .insert(workflows)
    .values({
      projectId,
      name: "Purchase receipt",
      description: "Draft — waiting on the billing webhook.",
      status: "DRAFT",
    })
    .returning();

  const id = (suffix: string) => `wf${workflow.id}-${suffix}`;

  await db.insert(workflowNodes).values([
    { id: id("trigger"), workflowId: workflow.id, type: "trigger", data: { event: "order_created", label: "Order created" }, positionX: 400, positionY: 0 },
    { id: id("receipt"), workflowId: workflow.id, type: "action", data: { triggerId: campaignByName.get("Order confirmation")!.id, label: "Send order confirmation" }, positionX: 400, positionY: 170 },
  ]);

  await db.insert(workflowEdges).values([
    { id: `${id("trigger")}->${id("receipt")}`, workflowId: workflow.id, sourceNodeId: id("trigger"), targetNodeId: id("receipt"), sourceHandle: null },
  ]);
}

/**
 * Executions and step executions for the onboarding automation. These are what
 * `getNodeStats` aggregates into the Total / Active / Completed / Failed counts
 * drawn on each node, so the numbers have to add up down the branches.
 */
async function seedWorkflowRuns(
  workflow: SeededWorkflow,
  seededContacts: Array<{ id: number }>,
) {
  const { nodeIds } = workflow;

  // How many contacts reached each node, and how many are still sitting in it.
  const funnel: Array<{ nodeId: string; entered: number; pending: number; failed: number }> = [
    { nodeId: nodeIds.trigger, entered: 48, pending: 0, failed: 0 },
    { nodeId: nodeIds.welcome, entered: 48, pending: 0, failed: 1 },
    { nodeId: nodeIds.wait, entered: 47, pending: 6, failed: 0 },
    { nodeId: nodeIds.check, entered: 41, pending: 0, failed: 2 },
    { nodeId: nodeIds.tag, entered: 24, pending: 0, failed: 0 },
    { nodeId: nodeIds.exitActivated, entered: 24, pending: 0, failed: 0 },
    { nodeId: nodeIds.nudge, entered: 15, pending: 0, failed: 0 },
    { nodeId: nodeIds.waitAgain, entered: 15, pending: 4, failed: 0 },
    { nodeId: nodeIds.exitCold, entered: 11, pending: 0, failed: 0 },
  ];

  const totalRuns = 48;
  const stillRunning = 10; // 6 in the first wait + 4 in the second

  const executionRows = Array.from({ length: totalRuns }, (_, index) => {
    const startedAt = daysAgo(28 - Math.floor(index * 0.55));
    const running = index >= totalRuns - stillRunning;
    return {
      workflowId: workflow.id,
      contactId: seededContacts[index % seededContacts.length].id,
      status: running ? "RUNNING" : "COMPLETED",
      startedAt,
      completedAt: running
        ? null
        : new Date(startedAt.getTime() + (2 + random() * 4) * 86400000),
    };
  });

  const insertedExecutions = await db
    .insert(workflowExecutions)
    .values(executionRows)
    .returning();

  // A step still waiting has to belong to a run that is still going, or the
  // node badge says "6 active" while every execution reads as completed.
  const running = insertedExecutions.filter((e) => e.status === "RUNNING");
  const finished = insertedExecutions.filter((e) => e.status !== "RUNNING");
  let runningCursor = 0;

  const stepRows: Array<typeof workflowStepExecutions.$inferInsert> = [];

  for (const step of funnel) {
    for (let index = 0; index < step.entered; index++) {
      const status =
        index < step.pending
          ? "PENDING"
          : index < step.pending + step.failed
            ? "FAILED"
            : "COMPLETED";
      const execution =
        status === "PENDING"
          ? running[runningCursor++ % running.length]
          : finished[index % finished.length];
      const startedAt = new Date(
        execution.startedAt.getTime() + random() * 86400000,
      );

      stepRows.push({
        executionId: execution.id,
        nodeId: step.nodeId,
        status,
        result:
          status === "FAILED"
            ? { error: "Provider rejected the recipient address" }
            : null,
        startedAt,
        completedAt:
          status === "PENDING"
            ? null
            : new Date(startedAt.getTime() + random() * 3600000),
      });
    }
  }

  await db.insert(workflowStepExecutions).values(stepRows);
}

/**
 * 30 days of delivery events, so the dashboard shows a curve instead of zeroes.
 * Volume rises gently across the month and dips on weekends.
 */
async function seedDeliveryHistory(
  seededCampaigns: Array<{ id: number; name: string }>,
  seededContacts: Array<{ id: number; email: string }>,
) {
  const eventRows: Array<typeof campaignEvents.$inferInsert> = [];
  const logRows: Array<typeof triggeredSendLogs.$inferInsert> = [];

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = daysAgo(dayOffset, 10);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const growth = 1 + (29 - dayOffset) / 40;
    const sendCount = Math.round((isWeekend ? 9 : 24) * growth);

    for (let i = 0; i < sendCount; i++) {
      const campaign = pick(seededCampaigns);
      const contact = pick(seededContacts);
      const occurredAt = daysAgo(dayOffset);

      const bounced = random() < 0.02;

      eventRows.push({
        campaignId: campaign.id,
        contactId: contact.id,
        email: contact.email,
        type: "SENT",
        occurredAt,
      });

      if (bounced) {
        eventRows.push({
          campaignId: campaign.id,
          contactId: contact.id,
          email: contact.email,
          type: "BOUNCE",
          metadata: { reason: "mailbox_does_not_exist" },
          occurredAt: new Date(occurredAt.getTime() + 60000),
        });
        continue;
      }

      eventRows.push({
        campaignId: campaign.id,
        contactId: contact.id,
        email: contact.email,
        type: "DELIVERED",
        occurredAt: new Date(occurredAt.getTime() + 45000),
      });

      // Roughly a 46% open rate, and a third of openers click.
      if (random() < 0.46) {
        const openedAt = new Date(
          occurredAt.getTime() + (5 + random() * 600) * 60000,
        );
        eventRows.push({
          campaignId: campaign.id,
          contactId: contact.id,
          email: contact.email,
          type: "OPEN",
          occurredAt: openedAt,
        });

        if (random() < 0.33) {
          eventRows.push({
            campaignId: campaign.id,
            contactId: contact.id,
            email: contact.email,
            type: "CLICK",
            linkUrl: pick(CLICK_TARGETS),
            occurredAt: new Date(openedAt.getTime() + random() * 900000),
          });
        }
      }

      // A slice of the same traffic also lands in the triggered send log.
      if (random() < 0.35) {
        logRows.push({
          campaignId: campaign.id,
          email: contact.email,
          status: bounced ? "BOUNCED" : "DELIVERED",
          providerMessageId: `demo-${campaign.id}-${dayOffset}-${i}`,
          sentAt: occurredAt,
        });
      }
    }
  }

  // Chunked: a single insert of several thousand rows exceeds the parameter
  // limit of the Postgres wire protocol.
  const chunkSize = 500;
  for (let i = 0; i < eventRows.length; i += chunkSize) {
    await db.insert(campaignEvents).values(eventRows.slice(i, i + chunkSize));
  }
  for (let i = 0; i < logRows.length; i += chunkSize) {
    await db.insert(triggeredSendLogs).values(logRows.slice(i, i + chunkSize));
  }

  return { events: eventRows.length, logs: logRows.length };
}
