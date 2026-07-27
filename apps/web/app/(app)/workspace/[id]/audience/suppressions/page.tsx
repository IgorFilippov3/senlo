"use client";

import { PageHeader, Button, Badge } from "@senlo/ui";
import { Trash2, Search, ShieldCheck } from "lucide-react";
import {
  useProjectSuppressions,
  useDeleteSuppression,
} from "apps/web/queries/suppressions";
import { useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";

export default function SuppressionListPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const { data: suppressions = [], isLoading } =
    useProjectSuppressions(projectId);
  const { mutate: deleteSuppression, isPending: isDeleting } =
    useDeleteSuppression();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSuppressions = suppressions.filter((s) =>
    s.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDelete = (id: number) => {
    if (
      confirm(
        "Are you sure you want to remove this email from the suppression list? This will allow future emails to be sent to this address.",
      )
    ) {
      deleteSuppression(id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="Suppression List"
        description="Emails that are blocked from receiving messages due to bounces or spam complaints."
      />

      <div className="mt-8 space-y-6">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search email or project..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-zinc-500">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              Loading suppression list...
            </div>
          ) : filteredSuppressions.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 bg-zinc-50/30">
              <ShieldCheck className="mx-auto mb-4 text-zinc-300" size={48} />
              <p className="text-zinc-600 font-medium">
                Your suppression list is clean
              </p>
              <p className="text-sm mt-1">
                No email addresses have been blocked yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-200">
                    <th className="px-6 py-4 font-semibold text-zinc-700">
                      Email Address
                    </th>
                    <th className="px-6 py-4 font-semibold text-zinc-700">
                      Reason
                    </th>
                    <th className="px-6 py-4 font-semibold text-zinc-700">
                      Blocked At
                    </th>
                    <th className="px-6 py-4 font-semibold text-zinc-700 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredSuppressions.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-medium text-zinc-900">
                        {item.email}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={item.reason === "SPAM" ? "error" : "warning"}
                        >
                          {item.reason}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-zinc-500">
                        {format(new Date(item.createdAt), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50 border-transparent"
                          onClick={() => handleDelete(item.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 size={14} className="mr-1.5" />
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
