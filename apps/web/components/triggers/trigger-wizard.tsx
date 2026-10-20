"use client";

import { useRouter } from "next/navigation";
import {
  TriggerWizard as SharedTriggerWizard,
  type TriggerWizardValues,
  useProjectTemplates,
  useCreateTriggeredCampaign,
} from "@senlo/features";

interface TriggerWizardProps {
  projectId: number;
  projectName: string;
}

export function TriggerWizard({ projectId, projectName }: TriggerWizardProps) {
  const router = useRouter();
  const { data: templates = [], isLoading } = useProjectTemplates(projectId);
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
