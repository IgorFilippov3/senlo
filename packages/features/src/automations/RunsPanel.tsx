// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import type { WorkflowRunDetail, WorkflowRunSummary, WorkflowStepExecution } from "@senlo/core";
import { Badge, Button, Dialog, Input, Textarea } from "@senlo/ui";
import { ChevronLeft, FlaskConical, XCircle } from "lucide-react";
import type { RunsFilter } from "../data/actions";
import { useCancelRun, useContactRuns, useWorkflowRun, useWorkflowRuns } from "../data/workflows";

const STEP_LABELS: Record<string, string> = {
  trigger: "Trigger",
  action: "Send email",
  delay: "Wait",
  condition: "Condition",
  wait_event: "Wait for event",
  update_contact: "Update contact",
  http_request: "HTTP request",
  exit: "Exit",
};

const EXIT_REASONS: Record<string, string> = {
  completed: "reached the end",
  exit_node: "reached an Exit step",
  goal: "reached the goal",
  error: "a step failed",
  invalid_run: "its version or step is gone",
  upgrade: "ended by an upgrade",
  cancelled_api: "cancelled through the API",
  cancelled_user: "cancelled by a user",
  unsubscribed: "the contact unsubscribed",
  suppressed: "the address is suppressed",
};

const SKIP_REASONS: Record<string, string> = {
  frequency_cap: "over the workspace's frequency cap",
  UNSUBSCRIBE: "the contact unsubscribed",
  BOUNCE: "the address bounced",
  SPAM: "the contact reported spam",
  error: "failed, continued (If this step fails: continue)",
};

const formatTime = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

function StatusBadge({ status }: { status: WorkflowRunSummary["status"] | WorkflowStepExecution["status"] }) {
  const variant =
    status === "COMPLETED" ? "success" : status === "FAILED" ? "error" : status === "CANCELLED" || status === "SKIPPED" ? "warning" : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] uppercase font-bold">
      {status === "PENDING" ? "In progress" : status}
    </Badge>
  );
}

function RunRow({ run, onOpen, showWorkflow }: { run: WorkflowRunSummary; onOpen: () => void; showWorkflow?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200"
    >
      <span className="text-xs text-gray-400 tabular-nums w-14">#{run.id}</span>
      <span className="flex-1 min-w-0 truncate text-sm text-gray-900">
        {showWorkflow ? run.workflowName : run.contactEmail ?? `contact ${run.contactId}`}
      </span>
      {run.isTest && (
        <Badge variant="outline" className="text-[10px]">
          <FlaskConical size={10} className="mr-1" /> Test
        </Badge>
      )}
      <StatusBadge status={run.status} />
      <span className="text-xs text-gray-500 w-36 text-right">{formatTime(run.startedAt)}</span>
    </button>
  );
}

/** What a step did, in a line: the branch, why it was skipped, its error, its HTTP status. */
function stepNote(step: WorkflowStepExecution): string | null {
  const result = (step.result ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof result.branch === "string") parts.push(`took ${result.branch === "yes" ? "Yes" : "No"}`);
  if (result.timedOut) parts.push("timed out");
  if (typeof result.skipped === "string") parts.push(`skipped: ${SKIP_REASONS[result.skipped] ?? result.skipped}`);
  if (typeof result.status === "number") parts.push(`answered ${result.status}`);
  if (result.truncated) parts.push("response cut at 64 KB");
  if (typeof result.until === "string") parts.push(`waited until ${formatTime(result.until)}`);
  if (result.skippedForTest) parts.push("not waited (test run)");
  if (typeof result.sendLogId === "number") parts.push("email queued");
  if (typeof result.error === "string") parts.push(`error: ${result.error}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** One run: its steps in order, why it ended, its context, and Cancel while it runs. */
export function RunTimeline({ runId, onBack }: { runId: number; onBack?: () => void }) {
  const { data, isLoading, error } = useWorkflowRun(runId);
  const cancel = useCancelRun();

  if (isLoading) return <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />;
  if (error || !data) return <p className="text-sm text-red-600">{error?.message ?? "Run not found"}</p>;

  const { run, steps, graph } = data as WorkflowRunDetail;
  const node = (id: string) => graph?.nodes.find((n) => n.id === id);
  const waiting = run.status === "RUNNING" && run.waitingEvent;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to runs">
            <ChevronLeft size={16} />
          </Button>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">Run #{run.id}</span>
            <StatusBadge status={run.status} />
            {run.isTest && <Badge variant="outline">Test</Badge>}
            {run.generation > 0 && (
              <span className="text-xs text-gray-500">restarted {run.generation}×</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {run.contactEmail ?? `contact ${run.contactId}`} · started {formatTime(run.startedAt)}
            {run.completedAt ? ` · ended ${formatTime(run.completedAt)}` : ""}
            {run.exitReason ? ` · ${EXIT_REASONS[run.exitReason] ?? run.exitReason}` : ""}
          </p>
        </div>
        {run.status === "RUNNING" && (
          <Button
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(run.id)}
          >
            <XCircle size={14} className="mr-1.5" /> Cancel run
          </Button>
        )}
      </div>
      {cancel.error && <p className="text-sm text-red-600">{cancel.error.message}</p>}

      <ol className="space-y-2">
        {steps.map((step) => {
          const n = node(step.nodeId);
          const note = stepNote(step);
          return (
            <li key={step.id} className="flex gap-3 border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {(n?.data?.label as string | undefined) || STEP_LABELS[n?.type ?? ""] || step.nodeId}
                  </span>
                  <StatusBadge status={step.status} />
                </div>
                {note && <p className="text-xs text-gray-600 mt-0.5 break-words">{note}</p>}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(step.startedAt)}</span>
            </li>
          );
        })}
        {run.status === "RUNNING" && run.currentNodeId && !steps.some((s) => s.nodeId === run.currentNodeId) && (
          <li className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600">
            Next: {STEP_LABELS[node(run.currentNodeId)?.type ?? ""] ?? run.currentNodeId}
            {run.wakeAt ? ` at ${formatTime(run.wakeAt)}` : ""}
          </li>
        )}
      </ol>
      {waiting && (
        <p className="text-xs text-gray-600">
          Waiting for <code>{run.waitingEvent}</code> until {formatTime(run.wakeAt)}.
        </p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-gray-600">Context (trigger event and step outputs)</summary>
        <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-64">
          {JSON.stringify(run.context, null, 2)}
        </pre>
      </details>
    </div>
  );
}

const STATUSES: Array<RunsFilter["status"] | ""> = ["", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"];

/** The workflow's runs, filtered by status and contact, with a run's timeline on click. */
export function WorkflowRunsList({
  workflowId,
  initialRunId = null,
  initialIncludeTests = false,
}: {
  workflowId: number;
  initialRunId?: number | null;
  initialIncludeTests?: boolean;
}) {
  const [status, setStatus] = useState<RunsFilter["status"] | "">("");
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState("");
  const [includeTests, setIncludeTests] = useState(initialIncludeTests);
  const [pages, setPages] = useState<Array<number | undefined>>([undefined]);
  const [openRun, setOpenRun] = useState<number | null>(initialRunId);

  const filter: RunsFilter = {
    ...(status ? { status } : {}),
    ...(email ? { email } : {}),
    includeTests,
    beforeId: pages[pages.length - 1],
    limit: 25,
  };
  const { data, isLoading, error } = useWorkflowRuns(workflowId, filter, { refetchInterval: 10000 });

  if (openRun !== null) return <RunTimeline runId={openRun} onBack={() => setOpenRun(null)} />;

  const reset = () => setPages([undefined]);

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setEmail(emailInput.trim());
          reset();
        }}
      >
        <select
          className="h-9 rounded-md border border-gray-200 px-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as RunsFilter["status"] | "");
            reset();
          }}
          aria-label="Status"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : "All statuses"}
            </option>
          ))}
        </select>
        <Input
          className="w-56"
          placeholder="Contact email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
        />
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto">
          <input
            type="checkbox"
            checked={includeTests}
            onChange={(e) => {
              setIncludeTests(e.target.checked);
              reset();
            }}
          />
          Test runs
        </label>
      </form>

      {isLoading ? (
        <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
      ) : error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : data && data.runs.length > 0 ? (
        <div className="space-y-1">
          {data.runs.map((run) => (
            <RunRow key={run.id} run={run} onOpen={() => setOpenRun(run.id)} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 py-6 text-center">No runs yet.</p>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" disabled={pages.length <= 1} onClick={() => setPages(pages.slice(0, -1))}>
          Newer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!data?.nextBeforeId}
          onClick={() => data?.nextBeforeId && setPages([...pages, data.nextBeforeId])}
        >
          Older
        </Button>
      </div>
    </div>
  );
}

/** A contact's automation history: their runs in every workflow of the workspace, found by email. */
export function ContactRunsLookup({ projectId }: { projectId: number }) {
  const [input, setInput] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<number | null>(null);
  const { data, isLoading, error } = useContactRuns(projectId, email);

  if (openRun !== null) return <RunTimeline runId={openRun} onBack={() => setOpenRun(null)} />;

  return (
    <div className="space-y-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setEmail(input.trim() || null);
        }}
      >
        <Input className="flex-1" placeholder="Contact email" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" variant="outline" size="sm">
          Show history
        </Button>
      </form>
      {email === null ? null : isLoading ? (
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ) : error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : data && data.length > 0 ? (
        <div className="space-y-1">
          {data.map((run) => (
            <RunRow key={run.id} run={run} showWorkflow onOpen={() => setOpenRun(run.id)} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 py-4 text-center">No automation runs for this contact.</p>
      )}
    </div>
  );
}

/** The runs dialog of the editor: this workflow's runs and a contact's history across workflows. */
export function WorkflowRunsDialog({
  isOpen,
  onClose,
  workflowId,
  projectId,
  initialRunId,
}: {
  isOpen: boolean;
  onClose: () => void;
  workflowId: number;
  projectId: number;
  /** Opens this run's timeline first (after a test run starts). */
  initialRunId?: number | null;
}) {
  const [tab, setTab] = useState<"runs" | "contact">("runs");
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Runs" size="lg">
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["runs", "contact"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${
              tab === t ? "border-blue-600 text-gray-900 font-medium" : "border-transparent text-gray-500"
            }`}
          >
            {t === "runs" ? "This automation" : "Contact history"}
          </button>
        ))}
      </div>
      <div className="max-h-[65vh] overflow-auto pr-1">
        {tab === "runs" ? (
          <WorkflowRunsList
            key={initialRunId ?? "list"}
            workflowId={workflowId}
            initialRunId={initialRunId ?? null}
            initialIncludeTests={!!initialRunId}
          />
        ) : (
          <ContactRunsLookup projectId={projectId} />
        )}
      </div>
    </Dialog>
  );
}

/** Starts a test run of the saved draft: a contact of the workspace and a sample payload of the trigger event. */
export function TestRunDialog({
  isOpen,
  onClose,
  eventName,
  onStart,
  isStarting,
  errors,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The trigger's event, shown as the sample event's name. */
  eventName: string | null;
  onStart: (input: { email: string; payload: Record<string, unknown> }) => void;
  isStarting?: boolean;
  /** Why the last start was refused. */
  errors?: string[] | null;
}) {
  const [email, setEmail] = useState("");
  const [payload, setPayload] = useState("{\n  \n}");
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const submit = () => {
    let parsed: unknown;
    try {
      parsed = payload.trim() === "" ? {} : JSON.parse(payload);
    } catch {
      setPayloadError("The payload is not valid JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setPayloadError("The payload must be a JSON object.");
      return;
    }
    setPayloadError(null);
    onStart({ email: email.trim(), payload: parsed as Record<string, unknown> });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Test run"
      description="Runs the saved draft for one contact. Emails are really sent; delays are skipped and a wait for an event lasts at most a minute. Test runs are not counted as runs and stay out of the statistics."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isStarting || email.trim() === ""}>
            {isStarting ? "Starting..." : "Start test run"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-900">Contact email</span>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="someone@example.com" />
          <span className="text-xs text-gray-500">An existing contact of this workspace.</span>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-900">
            Sample payload{eventName ? ` of ${eventName}` : ""}
          </span>
          <Textarea
            className="font-mono text-xs min-h-[140px]"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
          <span className="text-xs text-gray-500">What {"{{event.*}}"} reads in this run.</span>
        </label>
        {payloadError && <p className="text-sm text-red-600">{payloadError}</p>}
        {errors && errors.length > 0 && (
          <ul className="list-disc pl-4 text-sm text-red-600 space-y-1">
            {errors.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
