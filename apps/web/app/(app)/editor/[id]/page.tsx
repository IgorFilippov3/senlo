import { notFound } from "next/navigation";
import {
  EmailTemplateRepository,
  CampaignRepository,
  ProjectRepository,
} from "@senlo/db";
import { EditorLayout } from "@senlo/editor";
import { EmailDesignDocument, emailDesignVersion, MergeTag } from "@senlo/core";
import {
  saveTemplateFromEditor,
  sendTestEmailAction,
  listSavedRowsAction,
  saveRowAction,
  deleteSavedRowAction,
} from "./actions";

interface EditorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaignId?: string }>;
}

const templateRepo = new EmailTemplateRepository();
const campaignRepo = new CampaignRepository();
const projectRepo = new ProjectRepository();

export default async function EditorIdPage({
  params,
  searchParams,
}: EditorPageProps) {
  const { id: idParam } = await params;
  const { campaignId: campaignIdParam } = await searchParams;

  const templateId = Number(idParam);
  if (!templateId || Number.isNaN(templateId)) {
    notFound();
  }

  let campaign = null;
  if (campaignIdParam) {
    campaign = await campaignRepo.findById(Number(campaignIdParam));
  } else {
    campaign = await campaignRepo.findByTemplateId(templateId);
  }

  const template = await templateRepo.findById(templateId);

  if (!template) {
    notFound();
  }

  const project = await projectRepo.findById(template.projectId);
  const hasAiProvider = !!project?.aiProviderId;

  const design: EmailDesignDocument =
    (template.designJson as EmailDesignDocument | null) ?? {
      version: emailDesignVersion,
      rows: [],
      settings: {
        backgroundColor: "#ffffff",
        contentWidth: 600,
        fontFamily: "Arial, sans-serif",
        textColor: "#111827",
      },
    };

  const mergeTags: MergeTag[] = [];
  if (campaign?.variablesSchema) {
    Object.keys(campaign.variablesSchema).forEach((key) => {
      mergeTags.push({
        label: key
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        value: `{{${key}}}`,
        category: "custom",
      });
    });
  }

  return (
    <EditorLayout
      initialDesign={design}
      templateId={templateId}
      projectId={template.projectId}
      hasAiProvider={hasAiProvider}
      templateName={template.name}
      templateSubject={template.subject}
      mergeTags={mergeTags}
      onSave={saveTemplateFromEditor}
      onSendTest={sendTestEmailAction}
      onListSavedRows={listSavedRowsAction}
      onSaveRow={saveRowAction}
      onDeleteSavedRow={deleteSavedRowAction}
    />
  );
}
