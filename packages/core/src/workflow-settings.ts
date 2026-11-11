// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { WorkflowSettings } from "./domain";
import { validateConditionGroup } from "./workflow-conditions";
import { isValidEventName } from "./workflow-events";

const UNITS = ["minutes", "hours", "days"];

/**
 * What is wrong with a workflow's settings, as messages for the user; empty
 * when they are fine. Isomorphic: the builder shows the same messages.
 */
export function validateWorkflowSettings(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value !== "object" || Array.isArray(value)) return ["Settings are malformed."];
  const settings = value as WorkflowSettings;
  const problems: string[] = [];

  if (settings.kind !== undefined && settings.kind !== "transactional" && settings.kind !== "lifecycle") {
    problems.push('The kind must be "transactional" or "lifecycle".');
  }

  if (settings.goal !== undefined) {
    const goal = settings.goal as WorkflowSettings["goal"];
    if (!goal || typeof goal.event !== "string" || !isValidEventName(goal.event)) {
      problems.push("The goal needs a valid event name.");
    }
    if (goal?.filters !== undefined) {
      problems.push(...validateConditionGroup(goal.filters, "trigger").map((p) => `Goal filters: ${p}`));
    }
  }

  if (settings.entry !== undefined) {
    const entry = settings.entry as WorkflowSettings["entry"];
    if (!entry || (entry.mode !== "once" && entry.mode !== "after_exit")) {
      problems.push('Entry must be "once" or "after_exit".');
    }
    const cooldown = entry?.cooldown;
    if (
      cooldown !== undefined &&
      (!cooldown || !Number.isInteger(cooldown.duration) || cooldown.duration < 1 || !UNITS.includes(cooldown.unit))
    ) {
      problems.push("The cooldown must be a whole number of minutes, hours or days.");
    }
  }

  return problems;
}
