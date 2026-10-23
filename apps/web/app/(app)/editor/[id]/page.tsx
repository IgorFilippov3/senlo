import { notFound } from "next/navigation";
import { Editor } from "@/components/editor/editor";
import {
  saveTemplateFromEditor,
  sendTestEmailAction,
  listSavedRowsAction,
  saveRowAction,
  deleteSavedRowAction,
} from "./actions";
import { requireUserId } from "@/lib/session";
import { getServices } from "@/lib/services";

interface EditorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaignId?: string }>;
}

export default async function EditorIdPage({ params, searchParams }: EditorPageProps) {
  const { id: idParam } = await params;
  const { campaignId: campaignIdParam } = await searchParams;

  const templateId = Number(idParam);
  const campaignId = campaignIdParam ? Number(campaignIdParam) : null;
  if (!templateId || Number.isNaN(templateId)) {
    notFound();
  }

  // The page renders the template's design and its trigger's variables, so it
  // goes through the same access check as the actions it hands to the editor.
  const data = await requireUserId()
    .then((userId) =>
      getServices().template.loadEditorData(
        userId,
        templateId,
        campaignId,
      ),
    )
    .catch(() => null);
  if (!data) {
    notFound();
  }

  const { template, project, design, mergeTags, baseUrl } = data;

  return (
    <Editor
      initialDesign={design}
      templateId={templateId}
      projectId={template.projectId}
      campaignId={campaignId}
      baseUrl={baseUrl}
      hasAiProvider={!!project.aiProviderId}
      previewData={{ workspaceName: project.name }}
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
