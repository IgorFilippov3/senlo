"use client";

import { useRouter } from "next/navigation";
import { NewWorkflowForm } from "@senlo/features";
import { useCreateWorkflow } from "apps/web/queries/automations";

export function NewWorkflow({ projectId }: { projectId: number }) {
  const router = useRouter();
  const create = useCreateWorkflow(projectId);

  return (
    <NewWorkflowForm
      onSubmit={(name) =>
        create.mutate(name, {
          onSuccess: (workflow) => router.push(`/workspace/${projectId}/automations/${workflow.id}`),
        })
      }
      onCancel={() => router.back()}
      isSubmitting={create.isPending}
      error={create.error?.message}
    />
  );
}
