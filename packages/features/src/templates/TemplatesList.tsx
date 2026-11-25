"use client";

import React, { useState } from "react";
import type { EmailTemplate } from "@senlo/core";
import { TemplateCard } from "./TemplateCard";
import { Badge, Card } from "@senlo/ui";
import { Grid2x2, Table2, FileText, Trash2, ExternalLink, Search } from "lucide-react";

export interface TemplatesListProps {
  templates: EmailTemplate[];
  onDelete?: (template: EmailTemplate) => void;
  renderLink?: (
    templateId: number,
    children: React.ReactNode,
  ) => React.ReactNode;
}

export function TemplatesList({
  templates,
  onDelete,
  renderLink,
}: TemplatesListProps) {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTemplates = templates.filter((template) =>
    `${template.name}\n${template.subject}`.toLowerCase().includes(normalizedSearch),
  );

  const handleDeleteClick = (e: React.MouseEvent, template: EmailTemplate) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(template);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Templates
          <Badge variant="secondary" className="ml-1 font-normal">
            {filteredTemplates.length}
          </Badge>
        </h2>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              size={18}
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search templates"
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--sl-color-focus-ring)] focus:border-[color:var(--sl-color-border-focus)] transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 items-center bg-zinc-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "grid"
                  ? "bg-white shadow-sm text-zinc-900"
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
                  ? "bg-white shadow-sm text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
              title="Table view"
            >
              <Table2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-zinc-100 rounded-xl">
          <FileText size={40} className="mx-auto text-zinc-300 mb-4" />
          <p className="text-zinc-500">No templates found in this project.</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-zinc-100 rounded-xl">
          <Search size={40} className="mx-auto text-zinc-300 mb-4" />
          <p className="text-zinc-500">No templates match your search.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onDelete={onDelete}
              renderLink={renderLink}
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
              {filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-zinc-50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-[color:var(--sl-color-accent-tint)] rounded-md text-[color:var(--sl-color-accent-hover)]">
                        <FileText size={16} />
                      </div>
                      <span className="font-medium text-zinc-900 group-hover:underline underline-offset-4">
                        {renderLink
                          ? renderLink(template.id, template.name)
                          : template.name}
                      </span>
                    </div>
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
                      {renderLink &&
                        renderLink(
                          template.id,
                          <div
                            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                            title="Edit in editor"
                          >
                            <ExternalLink size={16} />
                          </div>,
                        )}
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
