import { PageHeader } from "@senlo/ui";

export default function ProvidersLoading() {
  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <div className="animate-pulse">
        <PageHeader
          title="Email Providers"
          description="Configure and manage your email service providers."
          actions={<div className="h-9 w-32 bg-gray-200 rounded" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <div className="w-16 h-6 bg-gray-200 rounded" />
              </div>
              <div className="space-y-3">
                <div className="h-6 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="flex items-center gap-2 mt-4">
                  <div className="w-4 h-4 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}



