// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  bigserial,
  integer,
  text,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  primaryKey,
  unique,
  uniqueIndex,
  index,
  date,
} from "drizzle-orm/pg-core";

// --- Auth Tables (NextAuth) ---

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password"), // For credentials provider
  role: text("role").default("user"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// --- Core Domain Enums ---

export const campaignStatusEnum = pgEnum("campaign_status", [
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]);

export const campaignTypeEnum = pgEnum("campaign_type", [
  "STANDARD",
  "TRIGGERED",
]);

export const campaignEventTypeEnum = pgEnum("campaign_event_type", [
  "SENT",
  "DELIVERED",
  "OPEN",
  "CLICK",
  "BOUNCE",
  "SPAM_REPORT",
  "UNSUBSCRIBE",
  "FAILED",
]);

export const emailProviderTypeEnum = pgEnum("email_provider_type", [
  "RESEND",
  "MAILGUN",
  "SES",
  "POSTMARK",
  "SMTP",
  // Appended, not inserted: Postgres adds enum values at the end.
  "SENDGRID",
  "MAILJET",
  "CLOUDFLARE",
]);

export const aiProviderTypeEnum = pgEnum("ai_provider_type", [
  "OPENAI",
  "ANTHROPIC",
]);

export const workflowStatusEnum = pgEnum("workflow_status", [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
]);

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    /**
     * Owning organization in a managed install; null means the row belongs to
     * `user_id` alone (always, in self-hosted). No foreign key: organizations
     * live outside this schema.
     */
    organizationId: text("organization_id"),
    name: text("name").notNull(),
    description: text("description"),
    providerId: integer("provider_id").references(() => emailProviders.id, {
      onDelete: "set null",
    }),
    aiProviderId: integer("ai_provider_id").references(() => aiProviders.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    organizationIdx: index("projects_organization_id_idx").on(t.organizationId),
  }),
);

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  // Hidden preview text an inbox shows next to the subject line.
  preheader: text("preheader"),
  html: text("html").notNull(),
  designJson: jsonb("design_json"),
  status: text("status").notNull().default("draft"),
  locale: text("locale").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    locale: text("locale").default("en"),
    meta: jsonb("meta"),
    unsubscribed: boolean("unsubscribed").notNull().default(false),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unq: unique().on(table.projectId, table.email),
  }),
);

export const recipientLists = pgTable("recipient_lists", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const recipientListContacts = pgTable(
  "recipient_list_contacts",
  {
    listId: integer("list_id")
      .notNull()
      .references(() => recipientLists.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.listId, table.contactId] }),
  }),
);

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: campaignTypeEnum("type").notNull().default("STANDARD"),
  status: campaignStatusEnum("status").notNull().default("DRAFT"),

  // Sender info
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  replyTo: text("reply_to"),

  // Email content override
  subject: text("subject"), // Optional override for template subject
  preheader: text("preheader"),

  templateId: integer("template_id")
    .notNull()
    .references(() => emailTemplates.id, { onDelete: "cascade" }),
  localeTemplates: jsonb("locale_templates"),
  listId: integer("list_id").references(() => recipientLists.id, {
    onDelete: "cascade",
  }),
  variablesSchema: jsonb("variables_schema"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaignEvents = pgTable(
  "campaign_events",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    type: campaignEventTypeEnum("type").notNull(),
    linkUrl: text("link_url"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // A campaign's event feed (newest first), its hourly chart, and the
    // retention delete and the campaign delete cascade, all by campaign.
    campaignOccurredIdx: index("campaign_events_campaign_occurred_idx").on(
      t.campaignId,
      t.occurredAt.desc(),
    ),
    // The same with a type: the feed's type filter, link stats (CLICK), the
    // dashboard's recent bounces, spam reports and failures.
    campaignTypeOccurredIdx: index("campaign_events_campaign_type_occurred_idx").on(
      t.campaignId,
      t.type,
      t.occurredAt.desc(),
    ),
    // `contact_id` is a foreign key with ON DELETE SET NULL: without this,
    // deleting one contact scans every event.
    contactIdx: index("campaign_events_contact_id_idx").on(t.contactId),
    // No index on `metadata`: nothing looks events up by a message id, the
    // webhook finds the email through `triggered_send_logs`.
  }),
);

export const emailProviders = pgTable(
  "email_providers",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    /** See `projects.organizationId`. */
    organizationId: text("organization_id"),
    name: text("name").notNull(),
    type: emailProviderTypeEnum("type").notNull(),
    config: jsonb("config").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    organizationIdx: index("email_providers_organization_id_idx").on(t.organizationId),
  }),
);

export const aiProviders = pgTable(
  "ai_providers",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    /** See `projects.organizationId`. */
    organizationId: text("organization_id"),
    name: text("name").notNull(),
    type: aiProviderTypeEnum("type").notNull(),
    config: jsonb("config").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    organizationIdx: index("ai_providers_organization_id_idx").on(t.organizationId),
  }),
);

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /**
   * The key in the clear: only on rows from before hashing, until
   * `pnpm db:hash-api-keys` moves them. New rows leave it null.
   */
  key: text("key").unique(),
  /** SHA-256 of the key (`hashApiKey`); what bearer auth looks up. */
  keyHash: text("key_hash").unique(),
  /** The first characters of the key, shown in the list. */
  prefix: text("prefix"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const triggeredSendLogs = pgTable(
  "triggered_send_logs",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    /** `TriggeredSendLog["status"]`: PENDING, SUCCESS, DELIVERED, BOUNCED, COMPLAINED, FAILED. */
    status: text("status").notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    /** The trigger's merge data; a delivery webhook adds its raw event under `<provider>_event`. */
    data: jsonb("data"),
    /**
     * Set by a sender that may retry (an automation step: `wf-<run>-<step>`):
     * a second send with the key reuses this row instead of sending again.
     */
    dedupeKey: text("dedupe_key").unique("triggered_send_logs_dedupe_key_unq"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // How a delivery webhook finds the email it reports on.
    providerMessageIdx: index("triggered_send_logs_provider_message_id_idx").on(
      t.providerMessageId,
    ),
    // A trigger's send log (newest first), the retention delete and the
    // campaign delete cascade.
    campaignSentIdx: index("triggered_send_logs_campaign_sent_at_idx").on(
      t.campaignId,
      t.sentAt.desc(),
    ),
    // The webhook's fallback when the message id matches nothing: the latest
    // send of that campaign to that address.
    campaignEmailSentIdx: index("triggered_send_logs_campaign_email_sent_at_idx").on(
      t.campaignId,
      t.email,
      t.sentAt.desc(),
    ),
  }),
);

/**
 * A campaign's counters for one UTC day: what every statistics screen reads,
 * so statistics outlive the delivery log and the raw events (which a
 * retention policy may delete). Written in the same transaction as the row
 * they count:
 * - sent ... suppressed by a send log's status change, on the day the email
 *   was sent (`triggered_send_logs.sent_at`), so a delivery webhook arriving
 *   after midnight still counts on the send's day and a repeated webhook
 *   changes nothing;
 * - opened, clicked and their unique counts by `logEvent`, on the day of the
 *   open or click. Unique is per day: one address opening on three days counts
 *   three times.
 * Rows from before this table existed come from `pnpm db:backfill-stats`.
 */
export const campaignDailyStats = pgTable(
  "campaign_daily_stats",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    /** The campaign's project, copied so the dashboard reads by project without a join. */
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** UTC calendar day. */
    day: date("day", { mode: "string" }).notNull(),
    /** Accepted by the provider: logs in SUCCESS, DELIVERED, BOUNCED or COMPLAINED. */
    sent: integer("sent").notNull().default(0),
    delivered: integer("delivered").notNull().default(0),
    bounced: integer("bounced").notNull().default(0),
    complained: integer("complained").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    /** The part of `failed` refused because the recipient is suppressed. */
    suppressed: integer("suppressed").notNull().default(0),
    opened: integer("opened").notNull().default(0),
    clicked: integer("clicked").notNull().default(0),
    uniqueOpened: integer("unique_opened").notNull().default(0),
    uniqueClicked: integer("unique_clicked").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.campaignId, t.day] }),
    projectDayIdx: index("campaign_daily_stats_project_day_idx").on(t.projectId, t.day),
  }),
);

/**
 * Who has opened or clicked a campaign on a day: what makes a daily unique
 * count exact under concurrent opens (an insert that conflicts is not a new
 * unique). Only today's rows matter; older ones are deleted daily.
 */
export const campaignDailyUniques = pgTable(
  "campaign_daily_uniques",
  {
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    /** The event type: `OPEN` or `CLICK`. */
    kind: text("kind").notNull(),
    email: text("email").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.campaignId, t.day, t.kind, t.email] }),
  }),
);

/** One-off facts about this database, such as a data backfill having run. */
export const systemState = pgTable("system_state", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const savedRows = pgTable("saved_rows", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  projectId: integer("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  data: jsonb("data").notNull(), // The RowBlock JSON
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const suppressions = pgTable(
  "suppressions",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    reason: text("reason").notNull(), // 'SPAM', 'BOUNCE'
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    unq: unique().on(table.projectId, table.email),
  }),
);

/**
 * The automation event log: every event of a contact (system or custom),
 * with its payload. Kept for the project's log retention (deleted by the
 * daily retention job); runs copy what they need into their own context.
 */
export const contactEvents = pgTable(
  "contact_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    payload: jsonb("payload").notNull().default({}),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    contactNameCreatedIdx: index("contact_events_contact_name_created_idx").on(
      t.contactId,
      t.name,
      t.createdAt.desc(),
    ),
    projectCreatedIdx: index("contact_events_project_created_idx").on(t.projectId, t.createdAt),
    // NULL keys are distinct in Postgres, so only events sent with a key are unique.
    projectIdempotencyUnq: unique("contact_events_project_idempotency_key_unq").on(
      t.projectId,
      t.idempotencyKey,
    ),
  }),
);

export const workflows = pgTable(
  "workflows",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: workflowStatusEnum("status").notNull().default("DRAFT"),
    /** The version new runs start on (`workflow_versions.id`); no FK, the versions reference the workflow. */
    activeVersionId: integer("active_version_id"),
    /** The active version's trigger event name, copied for the trigger lookup. */
    triggerEvent: text("trigger_event"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    activeTriggerIdx: index("workflows_project_trigger_event_active_idx")
      .on(t.projectId, t.triggerEvent)
      .where(sql`${t.status} = 'ACTIVE'`),
  }),
);

/** One published graph of a workflow. Immutable: runs read the version they started on. */
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: serial("id").primaryKey(),
    workflowId: integer("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** `{ nodes, edges }` as saved. */
    graph: jsonb("graph").notNull(),
    settings: jsonb("settings").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    workflowVersionUnq: unique("workflow_versions_workflow_version_unq").on(t.workflowId, t.version),
  }),
);

export const workflowNodes = pgTable("workflow_nodes", {
  id: text("id").primaryKey(),
  workflowId: integer("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  data: jsonb("data").notNull(),
});

export const workflowEdges = pgTable("workflow_edges", {
  id: text("id").primaryKey(),
  workflowId: integer("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  sourceNodeId: text("source_node_id").notNull(),
  targetNodeId: text("target_node_id").notNull(),
  sourceHandle: text("source_handle"),
});

export const workflowExecutions = pgTable(
  "workflow_executions",
  {
    id: serial("id").primaryKey(),
    workflowId: integer("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("RUNNING"),
    /** The version the run executes (`workflow_versions.id`). Null only on rows from before versions. */
    versionId: integer("version_id").references(() => workflowVersions.id, { onDelete: "set null" }),
    /** `ExecutionContext`: the trigger event and step outputs. */
    context: jsonb("context").notNull().default({}),
    /** The cursor: the step the run is at (the graph is single-path). */
    currentNodeId: text("current_node_id"),
    /** When the cursor step is due; the sweeper re-queues runs past it. */
    wakeAt: timestamp("wake_at", { withTimezone: true }),
    /** `ExecutionExitReason`: why the run ended. */
    exitReason: text("exit_reason"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    // One run per contact per workflow at a time, decided by the database:
    // two events in a row can no longer both start one.
    runningUnq: uniqueIndex("workflow_executions_running_contact_unq")
      .on(t.workflowId, t.contactId)
      .where(sql`${t.status} = 'RUNNING'`),
    statusWakeIdx: index("workflow_executions_status_wake_at_idx").on(t.status, t.wakeAt),
  }),
);

export const workflowStepExecutions = pgTable(
  "workflow_step_executions",
  {
    id: serial("id").primaryKey(),
    executionId: integer("execution_id")
      .notNull()
      .references(() => workflowExecutions.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    status: text("status").notNull(),
    result: jsonb("result"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    // Each step runs at most once per run: a redelivered job finds its row.
    executionNodeUnq: unique("workflow_step_executions_execution_node_unq").on(t.executionId, t.nodeId),
  }),
);
