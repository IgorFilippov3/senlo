"use client";

import { useRouter } from "next/navigation";
import { TriggerWizard as SharedTriggerWizard, type TriggerWizardValues } from "@senlo/features";
import { useProjectTemplates } from "apps/web/queries/templates";
import { useCreateTriggeredCampaign } from "apps/web/queries/campaigns";

interface TriggerWizardProps {
  projectId: number;
  projectName: string;
}

export function TriggerWizard({ projectId, projectName }: TriggerWizardProps) {
  const router = useRouter();
  const { data: templates = [], isLoading } = useProjectTemplates({ projectId });
  const create = useCreateTriggeredCampaign();

  const handleSubmit = (values: TriggerWizardValues) => {
    create.mutate(
      { ...values, projectId },
      { onSuccess: (campaign) => router.push(`/workspace/${projectId}/triggers/${campaign.id}`) },
    );
  };

  return (
    <SharedTriggerWizard
      projectName={projectName}
      templates={templates}
      isLoadingTemplates={isLoading}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      isSubmitting={create.isPending}
      error={create.error?.message}
    />
  );
}
