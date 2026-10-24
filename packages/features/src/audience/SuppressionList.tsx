"use client";

import React, { useState } from "react";
import type { Suppression } from "@senlo/core";
import { Button, Badge, Card } from "@senlo/ui";
import { Trash2, Search, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { LoadingState } from "../shared/Loading";

export interface SuppressionListProps {
  suppressions: Suppression[];
  isLoading?: boolean;
  /** Removes the address; called at once, so the caller asks for confirmation first. */
  onDelete?: (id: number) => void;
  isDeleting?: boolean;
  showProjectColumn?: boolean;
}

export function SuppressionList({
  suppressions,
  isLoading,
  onDelete,
  isDeleting,
  showProjectColumn = false,
}: SuppressionListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSuppressions = suppressions.filter((s) => {
    const emailMatch = s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const projectMatch =
      showProjectColumn &&
      (s as any).projectName?.toLowerCase().includes(searchTerm.toLowerCase());
    return emailMatch || projectMatch;
  });

  // Asking first is the caller's: `SuppressionsScreen` opens a confirm dialog.
  const handleDelete = (id: number) => onDelete?.(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            size={18}
          />
          <input
            type="text"
            placeholder={
              showProjectColumn
                ? "Search email or project..."
                : "Search emails..."
            }
            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Badge variant="secondary" className="w-fit font-normal">
          {suppressions.length} Total
        </Badge>
      </div>

      <Card className="overflow-hidden border-zinc-200 shadow-sm">
        {isLoading ? (
          <LoadingState label="Loading suppression list..." />
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
                  {showProjectColumn && (
                    <th className="px-6 py-4 font-semibold text-zinc-700">
                      Project
                    </th>
                  )}
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
                    {showProjectColumn && (
                      <td className="px-6 py-4 text-zinc-600">
                        {(item as any).projectName || "Unknown"}
                      </td>
                    )}
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
      </Card>
    </div>
  );
}
