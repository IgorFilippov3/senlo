// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SenloActions } from "./actions";

/**
 * One function that reaches the host's server: the action's dotted name
 * (`"templates.create"`) and its arguments in, its result out. In a Next.js
 * host it is a single Server Action over `dispatchSenloAction` from
 * `@senlo/next`; any other transport (fetch, RPC) works the same.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActionTransport = (name: string, args: unknown[]) => Promise<any>;

/** Every method of `SenloActions`, by group: what `createClientActions` builds. */
export const SENLO_ACTION_METHODS = {
  workspaces: ["list", "create", "update", "delete"],
  templates: ["list", "create", "delete"],
  campaigns: ["listForProject", "events", "linkStats", "timeSeries", "createTriggered", "updateTriggered", "delete"],
  emailProviders: ["list", "create", "update", "toggle", "delete"],
  aiProviders: ["list", "create", "toggle", "delete"],
  apiKeys: ["list", "create", "delete"],
  suppressions: ["listForProject", "delete"],
  dashboard: ["get"],
  workflows: ["list", "create", "saveGraph", "setStatus", "delete", "stats"],
} as const satisfies { [G in keyof SenloActions]: readonly (keyof SenloActions[G])[] };

/** `"group.method"` for every method of an actions interface. */
export type ActionNameOf<A> = {
  [G in keyof A & string]: { [M in keyof A[G] & string]: `${G}.${M}` }[keyof A[G] & string];
}[keyof A & string];

type Listed = {
  [G in keyof typeof SENLO_ACTION_METHODS]: `${G}.${(typeof SENLO_ACTION_METHODS)[G][number]}`;
}[keyof typeof SENLO_ACTION_METHODS];
type Unlisted = Exclude<ActionNameOf<SenloActions>, Listed>;
// Fails to compile, naming the method, when SenloActions gains one not listed above.
const everyMethodListed: [Unlisted] extends [never] ? true : Unlisted = true;
void everyMethodListed;

/** Builds an actions object whose every method sends `"group.method"` and its arguments through `call`. */
export function actionsFromTransport<A>(
  methods: Record<string, readonly string[]>,
  call: ActionTransport,
): A {
  return Object.fromEntries(
    Object.entries(methods).map(([group, names]) => [
      group,
      Object.fromEntries(names.map((name) => [name, (...args: unknown[]) => call(`${group}.${name}`, args)])),
    ]),
  ) as A;
}

/** The client data layer over one transport; pass the result to `SenloDataProvider`. */
export function createClientActions(call: ActionTransport): SenloActions {
  return actionsFromTransport<SenloActions>(SENLO_ACTION_METHODS, call);
}
