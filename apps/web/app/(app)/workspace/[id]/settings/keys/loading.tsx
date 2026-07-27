import { PageHeader } from "@senlo/ui";

export default function ApiKeysLoading() {
  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <div className="animate-pulse">
        <PageHeader
          title="API Keys"
          description="Manage API keys for triggering email campaigns."
          actions={<div className="h-9 w-32 bg-gray-200 rounded" />}
        />

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-48" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 bg-gray-200 rounded w-16" />
                  <div className="h-8 bg-gray-200 rounded w-12" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
