"use client";

import { Card, Badge, Button } from "@senlo/ui";
import {
  User,
  Mail,
  ArrowRight,
  Settings2,
  Pencil,
  FolderOpen,
  Languages,
} from "lucide-react";
import Link from "next/link";
import { Campaign, Project, EmailTemplate } from "@senlo/core";
import { useDialogStore } from "apps/web/providers/dialogs/store";

interface TriggerConfigurationCardProps {
  campaign: Campaign;
  project: Project;
  template: EmailTemplate;
}

export function TriggerConfigurationCard({
  campaign,
  project,
  template,
}: TriggerConfigurationCardProps) {
  const openDialog = useDialogStore((state) => state.open);

  return (
    <>
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Settings2 size={20} strokeWidth={2.5} className="text-zinc-400" />
            Configuration
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 text-zinc-400 hover:text-blue-600"
            onClick={() =>
              openDialog("EDIT_TRIGGER_CONFIG", { campaign, project, template })
            }
          >
            <Pencil size={18} />
          </Button>
        </div>

        <div className="space-y-7">
          {/* Project Section */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Project
            </h4>
            <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-50/50 border border-zinc-100 rounded-xl group hover:border-zinc-200 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-white border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-blue-600 transition-colors">
                <FolderOpen size={16} />
              </div>
              <span className="text-sm font-medium text-zinc-700">
                {project.name}
              </span>
            </div>
          </div>

          {/* Sender Section */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Sender details
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3">
                <div className="w-5 h-5 flex items-center justify-center text-zinc-400">
                  <User size={14} />
                </div>
                <span className="text-sm text-zinc-600">
                  {campaign.fromName || "Default Sender"}
                </span>
              </div>
              <div className="flex items-center gap-3 px-3">
                <div className="w-5 h-5 flex items-center justify-center text-zinc-400">
                  <Mail size={14} />
                </div>
                <span className="text-sm text-zinc-600 font-mono">
                  {campaign.fromEmail || "hello@senlo.io"}
                </span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Content & Templates
            </h4>
            <div className="space-y-2">
              {/* Default Template */}
              <Link
                href={`/editor/${template.id}?campaignId=${campaign.id}`}
                className="flex items-center justify-between px-3 py-2 bg-zinc-50/50 border border-zinc-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="bg-white text-[10px] font-bold uppercase tracking-wider text-blue-600 border-blue-100"
                  >
                    {template.locale}
                  </Badge>
                  <span className="text-sm font-medium text-zinc-700 group-hover:text-blue-700">
                    {template.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] uppercase tracking-tighter h-4 px-1 text-zinc-400 border-zinc-100"
                  >
                    Default
                  </Badge>
                </div>
                <ArrowRight
                  size={14}
                  className="text-zinc-300 group-hover:text-blue-400 transition-colors"
                />
              </Link>

              {/* Localization Variants */}
              {campaign.localeTemplates &&
                Object.entries(campaign.localeTemplates).map(
                  ([locale, templateId]) => (
                    <Link
                      key={locale}
                      href={`/editor/${templateId}?campaignId=${campaign.id}`}
                      className="flex items-center justify-between px-3 py-2 bg-zinc-50/50 border border-zinc-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="bg-white text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-blue-600 group-hover:border-blue-100"
                        >
                          {locale}
                        </Badge>
                        <span className="text-sm text-zinc-600 group-hover:text-blue-700">
                          Template ID: {templateId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Languages
                          size={14}
                          className="text-zinc-300 group-hover:text-blue-300"
                        />
                        <ArrowRight
                          size={14}
                          className="text-zinc-200 group-hover:text-blue-400 transition-colors"
                        />
                      </div>
                    </Link>
                  ),
                )}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
