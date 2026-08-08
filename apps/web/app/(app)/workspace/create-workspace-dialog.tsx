"use client";

import { CreateWorkspaceDialog as SharedCreateWorkspaceDialog } from "@senlo/features";
import { useCreateProject } from "apps/web/queries/projects";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateWorkspaceDialog({
  isOpen,
  onClose,
}: CreateProjectDialogProps) {
  const { mutate: createProject, isPending: isCreating } = useCreateProject();

  async function handleSubmit(formData: FormData) {
    createProject(formData, {
      onSuccess: () => {
        onClose();
      },
      onError: (error) => {
        if (
          error &&
          typeof error === "object" &&
          "error" in error &&
          error.error
        ) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          //@ts-ignore
          const fieldErrors = error.error.fieldErrors;
          let errorMessage = "Validation failed";

          if (fieldErrors) {
            if ("name" in fieldErrors && fieldErrors.name?.[0]) {
              errorMessage = fieldErrors.name[0];
            } else if (
              "description" in fieldErrors &&
              fieldErrors.description?.[0]
            ) {
              errorMessage = fieldErrors.description[0];
            } else if ("general" in fieldErrors && fieldErrors.general?.[0]) {
              errorMessage = fieldErrors.general[0];
            }
          }

          alert(`Error: ${errorMessage}`);
        } else {
          // Handle other types of errors
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to create workspace. Please try again.";
          alert(errorMessage);
        }
      },
    });
  }

  return (
    <SharedCreateWorkspaceDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isCreating}
    />
  );
}
