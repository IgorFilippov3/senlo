// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  primaryKey,
  unique,
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
]);

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description"),
  providerId: integer("provider_id").references(() => emailProviders.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  designJson: jsonb("design_json"),
  status: text("status").notNull().default("draft"),
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

export const campaignEvents = pgTable("campaign_events", {
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
});

export const emailProviders = pgTable("email_providers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
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
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const triggeredSendLogs = pgTable("triggered_send_logs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  status: text("status").notNull(), // 'SUCCESS', 'FAILED'
  error: text("error"),
  data: jsonb("data"), // payload received in webhook
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
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
