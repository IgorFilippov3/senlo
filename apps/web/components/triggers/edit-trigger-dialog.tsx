"use client";

import type { Campaign, Project, EmailTemplate } from "@senlo/core";
import { EditTriggerDialog as SharedEditTriggerDialog } from "@senlo/features";
import { useProjectTemplates } from "apps/web/queries/templates";
import { useUpdateTriggeredCampaign } from "apps/web/queries/campaigns";

interface EditTriggerDialogProps {
  campaign: Campaign;
  project: Project;
  template: EmailTemplate;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditTriggerDialog({
  campaign,
  project,
  isOpen,
  onClose,
}: EditTriggerDialogProps) {
  const { data: templates = [] } = useProjectTemplates({ projectId: project.id });
  const update = useUpdateTriggeredCampaign(campaign.id);

  const handleSave = async (formData: FormData) => {
    try {
      await update.mutateAsync(formData);
      onClose();
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <SharedEditTriggerDialog
      campaign={campaign}
      project={project}
      templates={templates}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      isSaving={update.isPending}
    />
  );
}
