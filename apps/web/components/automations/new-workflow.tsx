"use client";

import { useRouter } from "next/navigation";
import { NewWorkflowForm, useCreateWorkflow } from "@senlo/features";

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
