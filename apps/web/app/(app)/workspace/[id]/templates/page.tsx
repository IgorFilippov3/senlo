import { notFound } from "next/navigation";
import { getWorkspace } from "../../actions";
import ProjectPage from "./page.server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPageWrapper({ params }: Props) {
  const { id: projectId } = await params;

  const projectResult = await getWorkspace(Number(projectId));
  if (!projectResult.success || !projectResult.data) return notFound();

  return <ProjectPage projectId={projectId} />;
}
