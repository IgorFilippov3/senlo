import { notFound } from "next/navigation";
import { EditorLayout } from "@senlo/editor";
import { EmailDesignDocument, emailDesignVersion, MergeTag } from "@senlo/core";
import {
  saveTemplateFromEditor,
  sendTestEmailAction,
  listSavedRowsAction,
  saveRowAction,
  deleteSavedRowAction,
} from "./actions";
import { access } from "apps/web/lib/access";
import { requireUserId } from "apps/web/lib/session";
import { repositories } from "apps/web/lib/services";

interface EditorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaignId?: string }>;
}

const templateRepo = repositories.templates;
const campaignRepo = repositories.campaigns;

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

  // The page renders the template's design and its trigger's variables, so it
  // needs the same access check as the actions it hands to the editor.
  const userId = await requireUserId().catch(() => null);
  if (!userId) {
    notFound();
  }

  const template = await access
    .requireInProject(userId, await templateRepo.findById(templateId), "Template")
    .catch(() => null);
  if (!template) {
    notFound();
  }

  const project = await access.requireProject(userId, template.projectId);
  const hasAiProvider = !!project.aiProviderId;

  let campaign = campaignIdParam
    ? await campaignRepo.findById(Number(campaignIdParam))
    : await campaignRepo.findByTemplateId(templateId);
  if (campaign && campaign.projectId !== template.projectId) {
    campaign = null;
  }

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
      templateLocale={template.locale}
      templatePreheader={template.preheader}
      mergeTags={mergeTags}
      onSave={saveTemplateFromEditor}
      onSendTest={sendTestEmailAction}
      onListSavedRows={listSavedRowsAction}
      onSaveRow={saveRowAction}
      onDeleteSavedRow={deleteSavedRowAction}
    />
  );
}
