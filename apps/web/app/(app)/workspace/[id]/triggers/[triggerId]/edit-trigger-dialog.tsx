"use client";

import { useState } from "react";
import { EditTriggerDialog as SharedEditTriggerDialog } from "@senlo/features";
import { Campaign, Project, EmailTemplate } from "@senlo/core";
import { updateCampaignAction } from "../actions";
import { logger } from "apps/web/lib/logger";
import { useTemplates } from "apps/web/hooks/use-templates";

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
  const [isSaving, setIsSaving] = useState(false);
  const { templates } = useTemplates({
    filters: { projectId: project.id },
    enabled: isOpen,
  });

  const handleSave = async (formData: FormData) => {
    setIsSaving(true);
    try {
      const result = await updateCampaignAction(campaign.id, formData);
      if ("success" in result && result.success) {
        onClose();
      } else if ("error" in result && result.error) {
        const fieldErrors = result.error.fieldErrors;
        let errorMessage = "Validation failed";

        if (fieldErrors) {
          if ("name" in fieldErrors && fieldErrors.name?.[0]) {
            errorMessage = fieldErrors.name[0];
          } else if ("fromEmail" in fieldErrors && fieldErrors.fromEmail?.[0]) {
            errorMessage = fieldErrors.fromEmail[0];
          } else if ("general" in fieldErrors && fieldErrors.general?.[0]) {
            errorMessage = fieldErrors.general[0];
          }
        }

        alert(`Error: ${errorMessage}`);
      }
    } catch (error) {
      logger.error("Failed to update campaign from info card", {
        campaignId: campaign.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      setIsSaving(false);
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
      isSaving={isSaving}
    />
  );
}
