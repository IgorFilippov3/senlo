// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  AppError,
  logError,
  type ActionResult,
  type EmailDesignDocument,
  type RowBlock,
  type SavedRow,
} from "@senlo/core";
import type { Services } from "@senlo/core/server";
import type { ActionNameOf, SenloActions } from "@senlo/features";
import { validateId, withErrorHandling, withFormErrors } from "./errors";
import type { SenloHost } from "./host";

/** The editor's server calls, shaped as `EditorLayout` takes them (`onSave`, `onSendTest`, saved rows). */
export interface SenloEditorActions {
  save(
    id: number,
    design: EmailDesignDocument,
    html: string,
    metadata?: { name: string; subject: string; locale?: string; preheader?: string | null },
  ): Promise<{ success: boolean; error?: string }>;
  sendTest(
    id: number,
    targetEmail: string,
    fromEmail: string,
    design: EmailDesignDocument,
    subject: string,
  ): Promise<{ success: boolean; error?: string }>;
  listSavedRows(): Promise<SavedRow[]>;
  saveRow(name: string, data: RowBlock, projectId?: number): Promise<{ success: boolean; data?: SavedRow }>;
  deleteSavedRow(id: number): Promise<{ success: boolean }>;
}

/** Everything a signed-in user's client may call: the data layer plus the editor. */
export interface SenloServerActions extends SenloActions {
  editor: SenloEditorActions;
}

/** Calls that need no session. */
export interface SenloPublicActions {
  unsubscribe: {
    /** The unsubscribe page; `confirmEmail` answers a legacy link's "type your address". */
    process(
      token: string,
      confirmEmail?: string,
    ): Promise<ActionResult<{ alreadyUnsubscribed?: boolean; needsEmail?: boolean }>>;
  };
}

export type SenloServerActionName = ActionNameOf<SenloServerActions>;
export type SenloPublicActionName = ActionNameOf<SenloPublicActions>;

type MethodOf<A, N> = N extends `${infer G}.${infer M}`
  ? G extends keyof A
    ? M extends keyof A[G]
      ? A[G][M]
      : never
    : never
  : never;

/**
 * How one action runs on the server. `refresh` actions change data: after
 * one succeeds the dispatcher calls `host.onMutated`, where a Next.js host
 * revalidates its pages.
 */
interface Handler<F> {
  refresh: boolean;
  run: F extends (...args: infer P) => infer R ? (host: SenloHost, ...args: P) => R : never;
}

type HandlerTable<A> = { [N in ActionNameOf<A>]: Handler<MethodOf<A, N>> };

type Run<P extends unknown[], T> = (services: Services, userId: string, ...args: P) => Promise<T>;

/** A call that changes nothing, as an `ActionResult`. */
const read = <P extends unknown[], T>(fn: Run<P, T>) => ({
  refresh: false,
  run: (host: SenloHost, ...args: P) =>
    withErrorHandling(async () => fn(host.getServices(), await host.requireUserId(), ...args)),
});

/** A change, as an `ActionResult`. */
const write = <P extends unknown[], T>(fn: Run<P, T>, refresh = true) => ({
  ...read(fn),
  refresh,
});

/** A change behind a form: a `FormValidationError` keeps its fields. */
const form = <P extends unknown[], T>(fn: Run<P, T>) => ({
  refresh: true,
  run: (host: SenloHost, ...args: P) =>
    withFormErrors(async () => fn(host.getServices(), await host.requireUserId(), ...args)),
});

/**
 * Every server action behind `SenloActions` and the editor, as today's
 * self-hosted Server Actions ran them. A member added to `SenloActions`
 * without an entry here fails to compile.
 */
const handlers: HandlerTable<SenloServerActions> = {
  "workspaces.list": read((s, userId) => s.project.listForUser(userId)),
  "workspaces.create": form((s, userId, values) => s.project.create(userId, values)),
  "workspaces.update": form((s, userId, projectId: number, values) => s.project.update(userId, projectId, values)),
  "workspaces.delete": write(async (s, userId, projectId: number) => {
    await s.project.delete(userId, projectId);
  }),

  "templates.list": read((s, userId, projectId: number) =>
    s.template.listProjectTemplates(userId, validateId(projectId, "projectId")),
  ),
  "templates.create": write((s, userId, projectId: number, values) =>
    s.template.create(userId, validateId(projectId, "projectId"), values),
  ),
  "templates.delete": write(async (s, userId, projectId: number, templateId: number) => {
    await s.template.delete(userId, validateId(projectId, "projectId"), templateId);
  }),

  "campaigns.listForProject": read((s, userId, projectId: number) => s.campaign.listForProject(userId, projectId)),
  "campaigns.events": read((s, userId, campaignId: number, { page, pageSize, type, search }) =>
    s.campaign.getEvents(userId, campaignId, { page, pageSize, type, search }),
  ),
  "campaigns.linkStats": read((s, userId, campaignId: number) => s.campaign.getLinkStats(userId, campaignId)),
  "campaigns.timeSeries": read((s, userId, campaignId: number, options) =>
    s.campaign.getTimeSeriesStats(userId, campaignId, options),
  ),
  "campaigns.createTriggered": form((s, userId, values) => s.campaign.createTriggered(userId, values)),
  "campaigns.updateTriggered": form((s, userId, campaignId: number, values) =>
    s.campaign.updateTriggered(userId, campaignId, values),
  ),
  "campaigns.delete": write(async (s, userId, campaignId: number) => {
    await s.campaign.delete(userId, campaignId);
  }),

  "emailProviders.list": read((s, userId) => s.emailProvider.listForUser(userId)),
  "emailProviders.create": form((s, userId, values) => s.emailProvider.create(userId, values)),
  "emailProviders.update": form((s, userId, providerId: number, values) =>
    s.emailProvider.update(userId, providerId, values),
  ),
  "emailProviders.toggle": write((s, userId, providerId: number, isActive: boolean) =>
    s.emailProvider.setActive(userId, providerId, isActive),
  ),
  "emailProviders.delete": write(async (s, userId, providerId: number) => {
    await s.emailProvider.delete(userId, providerId);
  }),

  "aiProviders.list": read((s, userId) => s.aiProvider.listForUser(userId)),
  "aiProviders.create": form((s, userId, values) => s.aiProvider.create(userId, values)),
  "aiProviders.toggle": write((s, userId, providerId: number, isActive: boolean) =>
    s.aiProvider.setActive(userId, providerId, isActive),
  ),
  "aiProviders.delete": write(async (s, userId, providerId: number) => {
    await s.aiProvider.delete(userId, providerId);
  }),

  "apiKeys.list": read((s, userId, projectId: number) =>
    s.settings.listApiKeys(userId, validateId(projectId, "projectId")),
  ),
  // The only response that carries the plain key; the list never does.
  "apiKeys.create": write((s, userId, projectId: number, name: string) =>
    s.settings.createApiKey(userId, validateId(projectId, "projectId"), name),
  ),
  "apiKeys.delete": write(async (s, userId, apiKeyId: number) => {
    await s.settings.deleteApiKey(userId, validateId(apiKeyId, "apiKeyId"));
  }),

  "suppressions.listForProject": read((s, userId, projectId: number) =>
    s.audience.listProjectSuppressions(userId, projectId),
  ),
  "suppressions.delete": write(async (s, userId, suppressionId: number) => {
    await s.audience.removeSuppression(userId, suppressionId);
  }),

  "dashboard.get": read((s, userId, projectId: number, { days, eventLimit }) =>
    s.dashboard.getData(userId, projectId, { days, eventLimit }),
  ),

  "workflows.list": read((s, userId, projectId: number) => s.workflow.listForProject(userId, projectId)),
  "workflows.create": write((s, userId, projectId: number, name: string) =>
    s.workflow.create(userId, projectId, { name }),
  ),
  // The editor keeps its own canvas; refreshing the page under it would reset it.
  "workflows.saveGraph": write(async (s, userId, workflowId: number, { nodes, edges }) => {
    await s.workflow.saveGraph(userId, workflowId, { nodes, edges });
  }, false),
  "workflows.setStatus": write(async (s, userId, workflowId: number, status) => {
    await s.workflow.setStatus(userId, workflowId, status);
  }),
  "workflows.delete": write(async (s, userId, workflowId: number) => {
    await s.workflow.delete(userId, workflowId);
  }),
  "workflows.stats": read(async (s, userId, workflowId: number) => {
    await s.workflow.requireWorkflow(userId, workflowId, "read");
    return s.automation.getWorkflowStats(workflowId);
  }),

  "editor.save": {
    refresh: true,
    run: async (host, id, design, html, metadata) => {
      try {
        const userId = await host.requireUserId();
        await host.getServices().template.saveFromEditor(userId, id, { design, html, metadata });
        return { success: true };
      } catch (error) {
        logError(host.logger, "Failed to save template from editor", error, { templateId: id });
        // The detail is in the log; the client gets a generic message so
        // driver output and internal paths do not reach the browser.
        return { success: false, error: "Could not save the template. Please try again." };
      }
    },
  },
  "editor.sendTest": {
    refresh: false,
    run: async (host, templateId, targetEmail, fromEmail, design, subject) => {
      try {
        const userId = await host.requireUserId();
        const { activeWorkers } = await host.getServices().template.sendTest(userId, templateId, {
          to: targetEmail,
          from: fromEmail,
          design,
          subject,
        });
        if (activeWorkers === 0) {
          host.logger.warn("Test email queued but no active workers found. Is the worker running?");
        }
        return { success: true };
      } catch (error) {
        logError(host.logger, "Failed to send test email from editor", error, { templateId });
        // Typed errors carry a message meant for the user; anything else stays in the log.
        const message = error instanceof AppError ? error.message : "Could not send the test email.";
        return { success: false, error: message };
      }
    },
  },
  "editor.listSavedRows": {
    refresh: false,
    run: async (host) => {
      const userId = await host.currentUserId();
      if (!userId) return [];
      return host.getServices().savedRow.list(userId);
    },
  },
  "editor.saveRow": {
    refresh: false,
    run: async (host, name, data, projectId) => {
      try {
        const userId = await host.requireUserId();
        const savedRow = await host.getServices().savedRow.save(userId, { name, data, projectId });
        return { success: true, data: savedRow };
      } catch (error) {
        logError(host.logger, "Failed to save row", error);
        return { success: false };
      }
    },
  },
  "editor.deleteSavedRow": {
    refresh: false,
    run: async (host, id) => {
      try {
        const userId = await host.requireUserId();
        await host.getServices().savedRow.delete(userId, id);
        return { success: true };
      } catch (error) {
        logError(host.logger, "Failed to delete saved row", error, { id });
        return { success: false };
      }
    },
  },
};

const publicHandlers: HandlerTable<SenloPublicActions> = {
  "unsubscribe.process": {
    refresh: false,
    run: (host, token, confirmEmail) =>
      withErrorHandling(async () => {
        // Tight: a legacy link is confirmed by typing the address, and that
        // must not be guessable by trying addresses in a loop. Per IP and per
        // link, so the limit holds even when the IP is unknown.
        await host.rateLimit.limitAction("unsubscribe", `token:${String(token).slice(0, 128)}`);
        const result = await host.getServices().unsubscribe.process(token, { confirmEmail });

        if (!result.ok) {
          if (result.reason === "confirm_email") return { needsEmail: true };
          throw result.reason === "invalid"
            ? new AppError("VALIDATION_ERROR", "This unsubscribe link is not valid.")
            : new AppError(
                "NOT_FOUND",
                confirmEmail ? "That address does not match this link." : "Recipient not found",
              );
        }

        return result.alreadyUnsubscribed ? { alreadyUnsubscribed: true } : {};
      }),
  },
};

const unknownAction = (): ActionResult<never> => ({
  success: false,
  error: new AppError("VALIDATION_ERROR", "Unknown action").toJSON(),
});

const succeeded = (result: unknown) =>
  typeof result === "object" && result !== null && (result as { success?: unknown }).success === true;

async function dispatch(
  table: Record<string, Handler<(...args: never[]) => Promise<unknown>>>,
  host: SenloHost,
  name: unknown,
  args: unknown,
): Promise<unknown> {
  // Both come from the browser: only a listed name with an argument list runs.
  if (typeof name !== "string" || !Object.hasOwn(table, name) || !Array.isArray(args)) {
    return unknownAction();
  }
  const handler = table[name];
  const result = await (handler.run as (host: SenloHost, ...args: unknown[]) => Promise<unknown>)(host, ...args);
  if (handler.refresh && succeeded(result)) {
    await host.onMutated?.(name);
  }
  return result;
}

/**
 * Runs a signed-in user's action by name: the body of the host's one Server
 * Action. Every call checks the session itself; without one a data-layer
 * call resolves to `UNAUTHORIZED`.
 *
 * ```ts
 * "use server";
 * export async function senloAction(name: string, args: unknown[]) {
 *   return dispatchSenloAction(host, name, args);
 * }
 * ```
 */
export function dispatchSenloAction(host: SenloHost, name: unknown, args: unknown): Promise<unknown> {
  return dispatch(handlers as never, host, name, args);
}

/** Runs an action that needs no session (the unsubscribe page). */
export function dispatchPublicAction(host: SenloHost, name: unknown, args: unknown): Promise<unknown> {
  return dispatch(publicHandlers as never, host, name, args);
}
