"use client";

import type { Campaign, Project, EmailTemplate } from "@senlo/core";
import {
  EditTriggerDialog as SharedEditTriggerDialog,
  useProjectTemplates,
  useUpdateTriggeredCampaign,
} from "@senlo/features";

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
  const { data: templates = [] } = useProjectTemplates(project.id);
  const update = useUpdateTriggeredCampaign(campaign.id);

  const handleSave = async (formData: FormData) => {
    try {
      await update.mutateAsync(Object.fromEntries(formData));
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
