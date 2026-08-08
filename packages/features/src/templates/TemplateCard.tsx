"use client";

import React from "react";
import { Card, Badge } from "@senlo/ui";
import type { EmailTemplate } from "@senlo/core";
import { FileText, Calendar, ArrowRight, Trash2 } from "lucide-react";

export interface TemplateCardProps {
  template: EmailTemplate;
  onDelete?: (template: EmailTemplate) => void;
  renderLink?: (
    templateId: number,
    children: React.ReactNode,
  ) => React.ReactNode;
}

export function TemplateCard({
  template,
  onDelete,
  renderLink,
}: TemplateCardProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(template);
  };

  const cardContent = (
    <Card className="h-full p-5 transition-shadow hover:shadow-md border-zinc-200 group-hover:border-zinc-300">
      <div className="flex flex-col h-full gap-4">
        <div className="flex items-start justify-between">
          <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
            <FileText size={20} className="text-blue-600" />
          </div>
          <div className="flex items-center gap-2">
            {template.locale && (
              <Badge
                variant="outline"
                className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-zinc-200"
              >
                {template.locale}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="flex items-center gap-1 font-normal text-zinc-500 border-zinc-200"
            >
              <Calendar size={12} />
              {template.createdAt instanceof Date
                ? template.createdAt.toLocaleDateString("en-GB")
                : String(template.createdAt)}
            </Badge>
            <button
              onClick={handleDelete}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete template"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors line-clamp-1">
            {template.name}
          </h3>
          <p className="text-sm text-zinc-500 line-clamp-2">
            {template.subject}
          </p>
        </div>

        <div className="mt-auto pt-4 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
          Open in editor
          <ArrowRight size={14} className="ml-1" />
        </div>
      </div>
    </Card>
  );

  if (renderLink) {
    return renderLink(template.id, cardContent);
  }

  return <div className="group relative">{cardContent}</div>;
}
