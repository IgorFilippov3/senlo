import { getWizardData } from "../actions";
import { TriggerWizard } from "./trigger-wizard";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = await getWizardData();
  const { id: workspaceId } = await params;

  if (!result.success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              !
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Failed to load wizard
            </h1>
            <p className="text-gray-600">
              We could not load the data needed to create a trigger. Please try
              again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TriggerWizard
      projects={result.data.projects}
      initialProjectId={workspaceId}
    />
  );
}
