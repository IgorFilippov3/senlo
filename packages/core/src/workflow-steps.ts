// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Step handlers: what a step type does when a run reaches it. The engine
 * (`AutomationService.processStep`) keeps everything around the step, the
 * same for every type: the cursor and its guards, the step row and its
 * idempotency, retries, `onError`, SKIPPED, step outputs, moving on. A
 * handler only does its type's work and says how it went.
 *
 * The built-in types (email, HTTP request, condition, wait, wait for event,
 * update contact, exit) are handlers too. A new channel later is a new
 * handler and a new node type (`send_sms`, `send_slack`, …), registered with
 * `AutomationService.registerStepHandler`; the engine does not change.
 */

import type {
  ExecutionExitReason,
  WorkflowExecution,
  WorkflowStepExecution,
  WorkflowVersion,
} from "./domain";
import type { ConditionSnapshot } from "./workflow-conditions";
import type { Logger } from "./logger";

/** Where a job is in its retries; the worker passes BullMQ's counters. */
export interface StepAttempt {
  /** Attempts made before this one. */
  attemptsMade: number;
  /** Attempts the job has in total. */
  attempts: number;
}

/**
 * Who a step reaches. Steps **to the contact** (email; later SMS, push) go
 * through the contact's blocks (unsubscribe, suppression, the workflow's
 * `kind`) and the plan's send quota. Steps **outwards** (HTTP request; later
 * team alerts in Slack or Telegram) reach a URL or a team channel: blocks and
 * `kind` do not apply. `none`: logic only (conditions, waits).
 */
export type StepRecipient = "contact" | "outward" | "none";

/** What a handler gets for one step of one run. */
export interface StepContext {
  run: WorkflowExecution;
  version: WorkflowVersion;
  node: { id: string; type: string; data: Record<string, any> };
  /** The step's row (PENDING): `startedAt` is when the step first ran. */
  step: WorkflowStepExecution;
  /** The contact as conditions read it; read once, on first use. Null when it is gone. */
  contact(): Promise<ConditionSnapshot["contact"] | null>;
  /**
   * Stable per run, generation and step (`wf-<run>-<node>`): a side effect
   * keyed on it happens once even when the job runs again. Email dedupes its
   * send log on it; an outward step dedupes inside its handler.
   */
  dedupeKey: string;
  attempt: StepAttempt;
  /** The app's URL, for relative URLs. */
  baseUrl: string;
  logger: Logger;
}

/**
 * How a step went. A handler throws for a failure: `RetryableStepError` for
 * one that may pass (retried with backoff), anything else for one that will
 * not; the step's `onError` then decides.
 */
export type StepOutcome =
  /** Done: the run moves on, along `branch` for a step with Yes and No. `output` goes to `context.steps[nodeId]`. */
  | { kind: "done"; branch?: string; result?: Record<string, unknown> | null; output?: unknown }
  /** Did not apply (a blocked contact, the frequency cap): the step is SKIPPED with `reason` and the run moves on. */
  | { kind: "skipped"; reason: string; result?: Record<string, unknown> }
  /** The run stays at this step (waiting for an event or its timeout); something else moves it later. */
  | { kind: "waiting" }
  /** The run ends here. */
  | {
      kind: "end";
      status: "COMPLETED" | "CANCELLED";
      exitReason: ExecutionExitReason;
      stepStatus?: "COMPLETED" | "SKIPPED";
      result?: Record<string, unknown> | null;
    };

export interface StepHandler {
  /** The node type it runs (`action`, `http_request`, …). One type per channel. */
  type: string;
  recipient: StepRecipient;
  run(ctx: StepContext): Promise<StepOutcome>;
}
