import { redirect } from "next/navigation";

export default async function WorkspaceIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/workspace/${id}/dashboard`);
}
