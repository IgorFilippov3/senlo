"use client";

import { PageHeader } from "@senlo/ui";
import { SuppressionList } from "@senlo/features";
import {
  useProjectSuppressions,
  useDeleteSuppression,
} from "apps/web/queries/suppressions";
import { useParams } from "next/navigation";

export default function SuppressionListPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const { data: suppressions = [], isLoading } =
    useProjectSuppressions(projectId);
  const { mutate: deleteSuppression, isPending: isDeleting } =
    useDeleteSuppression();

  return (
    <div className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="Suppression List"
        description="Emails that are blocked from receiving messages due to bounces or spam complaints."
      />

      <div className="mt-8">
        <SuppressionList
          suppressions={suppressions}
          isLoading={isLoading}
          onDelete={(id) => deleteSuppression(id)}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
}
