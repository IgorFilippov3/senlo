"use client";

import { useState } from "react";
import Link from "next/link";
import type { Workflow } from "@senlo/core";
import { Button } from "@senlo/ui";
import {
  DeleteWorkflowDialog,
  GoLiveErrorsDialog,
  WorkflowList,
  WorkflowNotReadyError,
  useDeleteWorkflow,
  useProjectWorkflows,
  useSetWorkflowStatus,
} from "@senlo/features";

export function WorkflowsList({ projectId }: { projectId: number }) {
  const { data: workflows = [], isLoading } = useProjectWorkflows(projectId);
  const setStatus = useSetWorkflowStatus();
  const remove = useDeleteWorkflow();
  const [toDelete, setToDelete] = useState<Workflow | null>(null);
  const [goLiveErrors, setGoLiveErrors] = useState<string[] | null>(null);

  const toggle = (workflow: Workflow) =>
    setStatus.mutate(
      { id: workflow.id, status: workflow.status === "ACTIVE" ? "PAUSED" : "ACTIVE" },
      {
        onError: (error) =>
          error instanceof WorkflowNotReadyError
            ? setGoLiveErrors(error.reasons)
            : alert(error.message),
      },
    );

  const busyId =
    (setStatus.isPending && setStatus.variables?.id) ||
    (remove.isPending && remove.variables) ||
    null;

  return (
    <>
      <WorkflowList
        workflows={workflows}
        isLoading={isLoading}
        busyId={busyId}
        onToggleStatus={toggle}
        onDelete={setToDelete}
        renderEditLink={(workflow, children) => (
          <Link href={`/workspace/${projectId}/automations/${workflow.id}`}>{children}</Link>
        )}
        emptyAction={
          <Link href={`/workspace/${projectId}/automations/new`}>
            <Button>Create Automation</Button>
          </Link>
        }
      />

      <DeleteWorkflowDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        isDeleting={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => setToDelete(null),
            onError: (error) => alert(error.message),
          })
        }
      />

      <GoLiveErrorsDialog reasons={goLiveErrors} onClose={() => setGoLiveErrors(null)} />
    </>
  );
}
