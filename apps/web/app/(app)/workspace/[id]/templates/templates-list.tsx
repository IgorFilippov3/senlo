"use client";

import { useState } from "react";
import { EmailTemplate } from "@senlo/core";
import { TemplateCard } from "./template-card";
import { Badge, Card } from "@senlo/ui";
import { Grid2x2, Table2, FileText, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useDialogStore } from "apps/web/providers/dialogs/store";

interface TemplatesListProps {
  templates: EmailTemplate[];
  projectId: number;
  showFilters?: boolean;
}

export function TemplatesList({ templates, projectId }: TemplatesListProps) {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const openDialog = useDialogStore((state) => state.open);

  const handleDeleteClick = (e: React.MouseEvent, template: EmailTemplate) => {
    e.preventDefault();
    e.stopPropagation();
    openDialog("DELETE_TEMPLATE", { template, projectId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Templates
          <Badge variant="secondary" className="ml-1 font-normal">
            {templates.length}
          </Badge>
        </h2>

        <div className="flex items-center bg-zinc-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === "grid"
                ? "bg-white shadow-sm text-blue-600"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
            title="Grid view"
          >
            <Grid2x2 size={18} />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === "table"
                ? "bg-white shadow-sm text-blue-600"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
            title="Table view"
          >
            <Table2 size={18} />
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-zinc-100 rounded-xl">
          <FileText size={40} className="mx-auto text-zinc-300 mb-4" />
          <p className="text-zinc-500">No templates found in this project.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              projectId={projectId}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden border-zinc-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-zinc-50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/editor/${template.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="p-1.5 bg-blue-50 rounded-md text-blue-600">
                        <FileText size={16} />
                      </div>
                      <span className="font-medium text-zinc-900 group-hover:text-blue-600 transition-colors">
                        {template.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500 truncate max-w-[200px]">
                    {template.subject}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {template.createdAt instanceof Date
                      ? template.createdAt.toLocaleDateString("en-GB")
                      : String(template.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/editor/${template.id}`}
                        className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit in editor"
                      >
                        <ExternalLink size={16} />
                      </Link>
                      <button
                        onClick={(e) => handleDeleteClick(e, template)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete template"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
