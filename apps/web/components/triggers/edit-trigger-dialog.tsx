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

  // Clears a failed save, so the dialog does not reopen with an old error.
  const close = () => {
    update.reset();
    onClose();
  };

  const handleSave = async (formData: FormData) => {
    try {
      await update.mutateAsync(Object.fromEntries(formData));
      close();
    } catch {
      // Shown in the dialog from `update.error`.
    }
  };

  return (
    <SharedEditTriggerDialog
      campaign={campaign}
      project={project}
      templates={templates}
      isOpen={isOpen}
      onClose={close}
      onSave={handleSave}
      isSaving={update.isPending}
      error={update.error?.message}
    />
  );
}
