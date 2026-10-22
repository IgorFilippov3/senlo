// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OwnerScope } from "./access";
import type { EmailProviderType } from "./domain";
import { QuotaExceededError } from "./errors";
import { consoleLogger, type Logger } from "./logger";

/**
 * Ports a managed install plugs into the points where core already acts.
 * Self-hosted passes none of them: nothing is metered, nothing is limited,
 * no audit trail is kept, exactly as before.
 *
 * Billing has no port of its own: what billing needs (an email went out, a
 * project or contact was added) is exactly what `UsageMeter` receives, so a
 * managed meter feeds billing from the same events.
 */

/** Something that happened and may count toward usage or a bill. */
export type UsageEvent =
  | {
      type: "email.sent";
      projectId: number;
      /** `null` for a send that belongs to no campaign. */
      campaignId: number | null;
      provider: EmailProviderType;
    }
  | { type: "contact.created"; projectId: number; contactId: number }
  | { type: "project.created"; projectId: number; scope: OwnerScope };

export interface UsageMeter {
  record(event: UsageEvent): Promise<void>;
}

/**
 * Something about to happen that a plan may forbid. Sends and contacts name
 * their project (a send has no user behind it); a new project names the
 * scope it will belong to.
 */
export type QuotaAction =
  | { type: "email.send"; projectId: number }
  | { type: "contact.create"; projectId: number }
  | { type: "project.create"; scope: OwnerScope };

export type QuotaDecision = { allowed: true } | { allowed: false; reason: string };

export interface QuotaPolicy {
  check(action: QuotaAction): Promise<QuotaDecision>;
}

/** A change someone made, for an audit trail. */
export interface AuditEntry {
  /** The user who made the change. */
  actor: { userId: string };
  /** `<resource>.<verb>`, e.g. `provider.created`, `workflow.status_changed`. */
  action: string;
  target: { type: AuditTargetType; id: number; projectId?: number };
  /** Small, non-secret details (a new status, a name); never credentials. */
  details?: Record<string, unknown>;
}

export type AuditTargetType =
  | "project"
  | "email_provider"
  | "ai_provider"
  | "api_key"
  | "workflow"
  | "template";

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export const noUsageMeter: UsageMeter = { async record() {} };
export const allowAllQuotas: QuotaPolicy = {
  async check() {
    return { allowed: true };
  },
};
export const noAuditLog: AuditLog = { async record() {} };

/**
 * What services call. A meter or audit sink that fails is logged and
 * ignored: the change or send already happened, and failing it now would
 * show an error for something that worked, or make the queue retry a send
 * that went out. A quota check is different: it runs first, and a "no"
 * stops the action with `QuotaExceededError`.
 */
export class ServiceHooks {
  constructor(
    private readonly ports: {
      usage?: UsageMeter;
      quota?: QuotaPolicy;
      audit?: AuditLog;
    } = {},
    private readonly logger: Logger = consoleLogger,
  ) {}

  /** No metering, no limits, no audit: self-hosted. */
  static readonly none = new ServiceHooks();

  /** Throws `QuotaExceededError` when the policy says no. */
  async requireQuota(action: QuotaAction): Promise<void> {
    const decision = await (this.ports.quota ?? allowAllQuotas).check(action);
    if (!decision.allowed) throw new QuotaExceededError(decision.reason);
  }

  async recordUsage(event: UsageEvent): Promise<void> {
    try {
      await (this.ports.usage ?? noUsageMeter).record(event);
    } catch (error) {
      this.logger.error("Usage meter failed", { event: event.type, error: messageOf(error) });
    }
  }

  async audit(entry: AuditEntry): Promise<void> {
    try {
      await (this.ports.audit ?? noAuditLog).record(entry);
    } catch (error) {
      this.logger.error("Audit log failed", { action: entry.action, error: messageOf(error) });
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
