// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { notFound } from "next/navigation";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@senlo/core";
import type { TriggerDetailsScreenProps } from "@senlo/features";
import type { WorkflowEditorScreenProps } from "@senlo/features/workflow-editor";
import type { EditorScreenProps } from "./editor-screen";
import type { SenloHost } from "./host";

/*
 * Server page loaders: what a server page reads before it renders its
 * screen. Each takes the page's own props (Next passes `params` and
 * `searchParams` as promises) and returns the screen's props, so a host page
 * is the loader call plus the screen.
 *
 * One rule for failures: a bad id, a record the user may not see (or that
 * is gone) and a missing session are a 404, as the services already answer
 * "not found" for a foreign record; anything else is a fault and goes to the
 * route's error boundary instead of hiding behind a 404.
 */

/** A positive integer id from a route segment, or a 404. */
function pageId(value: string | undefined): number {
  const id = Number(value);
  if (!value || !Number.isInteger(id) || id <= 0) notFound();
  return id;
}

/** Runs a read; an expected "you cannot see this" becomes a 404, a fault is rethrown. */
async function orNotFound<T>(read: () => Promise<T | null>): Promise<T> {
  let result: T | null;
  try {
    result = await read();
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof ForbiddenError ||
      error instanceof UnauthorizedError
    ) {
      notFound();
    }
    throw error;
  }
  if (result === null) notFound();
  return result;
}

export interface EditorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaignId?: string }>;
}

/** What `EditorScreen` needs besides the host's `call` (and `endpoints`, if not the defaults). */
export type EditorPageData = Omit<EditorScreenProps, "call" | "endpoints">;

/**
 * The editor page: the template, its trigger's variables and the project's
 * base URL, through the same access check as the editor's save and test
 * send. `?campaignId=` must be a trigger of the template's project.
 */
export async function loadEditorPage(host: SenloHost, page: EditorPageProps): Promise<EditorPageData> {
  const [{ id }, { campaignId: campaignParam }] = await Promise.all([page.params, page.searchParams]);
  const templateId = pageId(id);
  const campaignId = campaignParam ? pageId(campaignParam) : null;

  const { template, project, design, mergeTags, baseUrl } = await orNotFound(async () =>
    host.getServices().template.loadEditorData(await host.requireUserId(), templateId, campaignId),
  );

  return {
    initialDesign: design,
    templateId,
    projectId: template.projectId,
    campaignId,
    baseUrl,
    hasAiProvider: !!project.aiProviderId,
    previewData: { workspaceName: project.name },
    templateName: template.name,
    templateSubject: template.subject,
    templateLocale: template.locale,
    templatePreheader: template.preheader,
    mergeTags,
  };
}

export interface TriggerPageProps {
  params: Promise<{ id: string; triggerId: string }>;
}

/** The trigger page: the trigger with its template, project and stats. */
export async function loadTriggerPage(
  host: SenloHost,
  page: TriggerPageProps,
): Promise<TriggerDetailsScreenProps> {
  const triggerId = pageId((await page.params).triggerId);
  const details = await orNotFound(async () =>
    host.getServices().campaign.getDetails(await host.requireUserId(), triggerId),
  );
  const { appUrl, defaultFromEmail } = host.getConfig();
  return { details, apiEndpointUrl: `${appUrl}/api/triggered`, defaultFromEmail };
}

export interface WorkflowPageProps {
  params: Promise<{ id: string; workflowId: string }>;
}

/** The automation editor page: the workflow and its saved graph. */
export async function loadWorkflowPage(
  host: SenloHost,
  page: WorkflowPageProps,
): Promise<WorkflowEditorScreenProps> {
  const workflowId = pageId((await page.params).workflowId);
  return orNotFound(async () =>
    host.getServices().workflow.getGraph(await host.requireUserId(), workflowId),
  );
}
