export default function ProjectLoading() {
  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-96" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 bg-gray-200 rounded w-24" />
            <div className="h-9 bg-gray-200 rounded w-32" />
          </div>
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-6 border-b border-gray-100 mb-8 animate-pulse">
        <div className="pb-4">
          <div className="h-5 bg-gray-200 rounded w-24 mb-2" />
        </div>
        <div className="pb-4">
          <div className="h-5 bg-gray-200 rounded w-16 mb-2" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="w-12 h-5 bg-gray-200 rounded" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
