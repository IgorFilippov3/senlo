// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { and, desc, eq, gte, max, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ContactEvent, IContactEventRepository } from "@senlo/core";
import * as schema from "../schema";
import { contactEvents } from "../schema";

type Row = typeof contactEvents.$inferSelect;

/** The automation event log (`contact_events`). */
export class ContactEventRepository implements IContactEventRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  private map(row: Row): ContactEvent {
    return {
      id: row.id,
      projectId: row.projectId,
      contactId: row.contactId,
      name: row.name,
      payload: (row.payload as Record<string, unknown> | null) ?? {},
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
    };
  }

  async record(data: {
    projectId: number;
    contactId: number;
    name: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string | null;
  }): Promise<ContactEvent | null> {
    // The unique (project_id, idempotency_key) decides a race between two
    // requests with one key: only the insert that wins returns a row.
    const [row] = await this.db
      .insert(contactEvents)
      .values({
        projectId: data.projectId,
        contactId: data.contactId,
        name: data.name,
        payload: data.payload,
        idempotencyKey: data.idempotencyKey ?? null,
      })
      .onConflictDoNothing({ target: [contactEvents.projectId, contactEvents.idempotencyKey] })
      .returning();
    return row ? this.map(row) : null;
  }

  async findByIdempotencyKey(projectId: number, idempotencyKey: string): Promise<ContactEvent | null> {
    const [row] = await this.db
      .select()
      .from(contactEvents)
      .where(and(eq(contactEvents.projectId, projectId), eq(contactEvents.idempotencyKey, idempotencyKey)))
      .limit(1);
    return row ? this.map(row) : null;
  }

  async existsSince(contactId: number, name: string, since: Date): Promise<boolean> {
    const [row] = await this.db
      .select({ id: contactEvents.id })
      .from(contactEvents)
      .where(
        and(eq(contactEvents.contactId, contactId), eq(contactEvents.name, name), gte(contactEvents.createdAt, since)),
      )
      .limit(1);
    return Boolean(row);
  }

  async listSince(contactId: number, name: string, since: Date, limit: number): Promise<ContactEvent[]> {
    const rows = await this.db
      .select()
      .from(contactEvents)
      .where(
        and(eq(contactEvents.contactId, contactId), eq(contactEvents.name, name), gte(contactEvents.createdAt, since)),
      )
      .orderBy(desc(contactEvents.createdAt), desc(contactEvents.id))
      .limit(limit);
    return rows.map((r) => this.map(r));
  }

  async recentNames(projectId: number, limit: number): Promise<string[]> {
    const last = max(contactEvents.createdAt);
    const rows = await this.db
      .select({ name: contactEvents.name, last })
      .from(contactEvents)
      .where(eq(contactEvents.projectId, projectId))
      .groupBy(contactEvents.name)
      .orderBy(desc(last), contactEvents.name)
      .limit(limit);
    return rows.map((r) => r.name);
  }

  async payloadKeys(projectId: number, name: string, sample: number): Promise<string[]> {
    const result = (await this.db.execute(sql`
      SELECT DISTINCT k AS key
      FROM (
        SELECT payload FROM ${contactEvents}
        WHERE project_id = ${projectId} AND name = ${name} AND jsonb_typeof(payload) = 'object'
        ORDER BY id DESC
        LIMIT ${sample}
      ) e, jsonb_object_keys(e.payload) AS k
      ORDER BY 1
      LIMIT 200
    `)) as unknown as { rows: Array<{ key: string }> };
    return result.rows.map((r) => r.key);
  }

  /** A contact's events, newest first (its automation history). */
  async listByContact(contactId: number, limit = 100): Promise<ContactEvent[]> {
    const rows = await this.db
      .select()
      .from(contactEvents)
      .where(eq(contactEvents.contactId, contactId))
      .orderBy(desc(contactEvents.createdAt), desc(contactEvents.id))
      .limit(limit);
    return rows.map((r) => this.map(r));
  }
}
