"use client";

import React from "react";
import type { Campaign, CampaignStats, EmailTemplate, Project } from "@senlo/core";
import {
  PageHeader,
  Card,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@senlo/ui";
import {
  Send,
  Eye,
  MousePointer2,
  Zap,
  Terminal,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { TriggerApiInfo } from "./TriggerApiInfo";
import { TriggerConfigurationCard } from "./TriggerConfigurationCard";

export interface TriggerStatsGridProps {
  stats: CampaignStats;
}

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

export function TriggerStatsGrid({ stats }: TriggerStatsGridProps) {
  const tiles: {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    color?: string;
    sub?: string;
  }[] = [
    { label: "Sent", value: stats.sent, icon: <Send size={16} /> },
    {
      label: "Delivered",
      value: stats.delivered,
      icon: <CheckCircle2 size={16} className="text-green-500" />,
    },
    {
      label: "Errors",
      value: stats.errors,
      icon: <Terminal size={16} />,
      color: stats.errors > 0 ? "text-red-500" : undefined,
    },
    {
      label: "Open Rate",
      value: `${percent(stats.opens.unique, stats.sent)}%`,
      icon: <Eye size={16} />,
      sub: `${stats.opens.unique} unique / ${stats.opens.total} total`,
    },
    {
      label: "Click Rate",
      value: `${percent(stats.clicks.unique, stats.sent)}%`,
      icon: <MousePointer2 size={16} />,
      sub: `${stats.clicks.unique} unique / ${stats.clicks.total} total`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {tiles.map((s) => (
        <Card key={s.label} className="p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">{s.label}</span>
            {s.icon}
          </div>
          <div className={`text-2xl font-bold ${s.color || "text-zinc-900"}`}>{s.value}</div>
          {s.sub && <div className="text-[10px] text-zinc-500">{s.sub}</div>}
        </Card>
      ))}
    </div>
  );
}

export interface TriggerDetailsViewProps {
  campaign: Campaign;
  project: Project;
  template: EmailTemplate;
  stats: CampaignStats;
  /** Full URL of the send endpoint, from the server's configured app URL. */
  apiEndpointUrl: string;
  /** Sender address used when the trigger sets none (server config). */
  defaultFromEmail: string;
  /** Wraps the "Back to Triggers" label in a link to the list. */
  renderBackLink: (children: React.ReactNode) => React.ReactNode;
  renderTemplateLink: (templateId: number, children: React.ReactNode) => React.ReactNode;
  onEdit?: () => void;
  /** Contents of the "Delivery Logs" tab. */
  deliveryLogs: React.ReactNode;
  /** Contents of the "Analytics" tab. */
  analytics: React.ReactNode;
}

export function TriggerDetailsView({
  campaign,
  project,
  template,
  stats,
  apiEndpointUrl,
  defaultFromEmail,
  renderBackLink,
  renderTemplateLink,
  onEdit,
  deliveryLogs,
  analytics,
}: TriggerDetailsViewProps) {
  const badge = "bg-zinc-900 text-white border-none font-bold py-1.5 px-3";

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <div className="mb-6 flex items-center justify-between">
        {renderBackLink(
          <span className="text-sm text-zinc-500 hover:text-zinc-800 flex items-center gap-1 transition-colors">
            <ArrowLeft size={14} />
            Back to Triggers
          </span>,
        )}

        <Badge className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white border-none font-bold tracking-tight shadow-md hover:bg-zinc-800 transition-colors">
          <Zap size={15} className="text-blue-400 fill-blue-400" />
          Email Trigger
        </Badge>
      </div>

      <PageHeader
        title={campaign.name}
        description={
          campaign.description || "API-driven email. Emails are sent automatically via webhook."
        }
        actions={
          <div className="flex items-center gap-3">
            <Badge className={badge}>ID: {campaign.id}</Badge>
            <Badge className={badge}>ACTIVE</Badge>
          </div>
        }
      />

      <Tabs defaultValue="delivery" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="delivery">Delivery Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <TriggerStatsGrid stats={stats} />
              <TriggerApiInfo
                campaignId={campaign.id}
                endpointUrl={apiEndpointUrl}
                sampleData={campaign.variablesSchema}
                hasLocales={Object.keys(campaign.localeTemplates ?? {}).length > 0}
              />
            </div>

            <div className="space-y-6">
              <TriggerConfigurationCard
                campaign={campaign}
                project={project}
                template={template}
                defaultFromEmail={defaultFromEmail}
                onEdit={onEdit}
                renderTemplateLink={renderTemplateLink}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="delivery">
          <Card className="p-6">
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 size={20} className="text-zinc-400" />
                Delivery Activity
              </h3>
              {deliveryLogs}
            </section>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">{analytics}</TabsContent>
      </Tabs>
    </main>
  );
}
