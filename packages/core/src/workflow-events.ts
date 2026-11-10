// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Event names and the trigger match, shared by the events API, the run
 * engine and the automation builder. No server dependencies: the builder
 * imports it in the browser.
 */

/** Events with a side effect on the contact. Any other valid name is a custom event. */
export const SYSTEM_EVENT_TYPES = ["contact_added", "contact_updated", "tag_added"] as const;
export type SystemEventType = (typeof SYSTEM_EVENT_TYPES)[number];

/** Lowercase, starts with a letter or digit, then `_ . : -`, 64 characters at most. */
export const EVENT_NAME_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;

/** Largest event payload, as serialized JSON. */
export const MAX_EVENT_PAYLOAD_BYTES = 32 * 1024;

export const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

export function isSystemEvent(name: string): name is SystemEventType {
  return (SYSTEM_EVENT_TYPES as readonly string[]).includes(name);
}

export function isValidEventName(name: string): boolean {
  return EVENT_NAME_PATTERN.test(name);
}

/** An event as the engine sees it. */
export interface WorkflowEvent {
  name: string;
  payload: Record<string, unknown>;
}

/**
 * Whether a trigger node's data accepts the event: the name must be equal;
 * a `tag_added` trigger with a `tag` also needs that tag in `payload.tags`.
 * Full `filters` come with the condition engine.
 */
export function triggerMatches(data: Record<string, unknown>, event: WorkflowEvent): boolean {
  if (data.event !== event.name) return false;
  if (event.name === "tag_added" && typeof data.tag === "string" && data.tag.trim() !== "") {
    const tags = event.payload.tags;
    return Array.isArray(tags) && tags.includes(data.tag.trim());
  }
  return true;
}
