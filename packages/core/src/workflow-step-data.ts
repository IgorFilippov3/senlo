// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Contact, ExecutionContext } from "./domain";

/** The merge data of an email sent by an automation step. */
export interface StepData extends Record<string, unknown> {
  contact: Record<string, unknown>;
  event: Record<string, unknown>;
  steps: Record<string, unknown>;
}

/**
 * The data an automation email is rendered with, the one place it is built:
 *
 * - the contact's attributes at the top level (`{{first_name}}`), the same
 *   flat shape `POST /api/triggered` sends its `data` in, so one template
 *   works from the API and from an automation;
 * - `contact`: email, name, locale and the attributes (`{{contact.email}}`);
 * - `event`: the trigger event's payload (`{{event.total}}`);
 * - `steps`: step outputs by node id (`{{steps.<nodeId>.body.plan}}`).
 *
 * The three namespaces win over an attribute with the same name.
 */
export function buildStepData(
  contact: Pick<Contact, "email" | "name" | "locale" | "meta">,
  context: ExecutionContext,
): StepData {
  const meta = (contact.meta as Record<string, unknown> | null | undefined) ?? {};
  return {
    ...meta,
    contact: {
      ...meta,
      email: contact.email,
      name: contact.name ?? null,
      locale: contact.locale ?? null,
    },
    event: context.event?.payload ?? {},
    steps: context.steps,
  };
}
