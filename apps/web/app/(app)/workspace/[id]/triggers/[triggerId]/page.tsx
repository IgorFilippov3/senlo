import { notFound } from "next/navigation";
import { getCampaignDetails } from "../actions";
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
import Link from "next/link";
import { DeliveryLogs } from "./delivery-logs";
import { AnalyticsTab } from "./analytics/analytics-tab";
import { WebhookInfo } from "./webhook-info";
import { TriggerConfigurationCard } from "./trigger-configuration-card";
import { TriggerPolling } from "./trigger-polling";

interface CampaignDetailsPageProps {
  params: Promise<{ id: string; triggerId: string }>;
}

export default async function CampaignDetailsPage({
  params,
}: CampaignDetailsPageProps) {
  const { id: workspaceId, triggerId: idParam } = await params;
  const id = Number(idParam);

  if (isNaN(id)) return notFound();

  const details = await getCampaignDetails(id);
  if (!details) return notFound();

  const { campaign, project, template, stats } = details;

  const openRate =
    stats.sent > 0 ? Math.round((stats.opens.unique / stats.sent) * 100) : 0;
  const clickRate =
    stats.sent > 0 ? Math.round((stats.clicks.unique / stats.sent) * 100) : 0;

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <TriggerPolling campaignId={campaign.id} status={campaign.status} />
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/workspace/${workspaceId}/triggers`}
          className="text-sm text-zinc-500 hover:text-zinc-800 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Triggers
        </Link>

        <Badge className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white border-none font-bold tracking-tight shadow-md hover:bg-zinc-800 transition-colors">
          <Zap size={15} className="text-blue-400 fill-blue-400" />
          Email Trigger
        </Badge>
      </div>

      <PageHeader
        title={campaign.name}
        description={
          campaign.description ||
          "API-driven email. Emails are sent automatically via webhook."
        }
        actions={
          <div className="flex items-center gap-3">
            <Badge className="bg-zinc-900 text-white border-none font-bold py-1.5 px-3">
              ID: {campaign.id}
            </Badge>
            <Badge className="bg-zinc-900 text-white border-none font-bold py-1.5 px-3">
              ACTIVE
            </Badge>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Sent",
                    value: stats.sent,
                    icon: <Send size={16} />,
                  },
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
                    value: `${openRate}%`,
                    icon: <Eye size={16} />,
                    sub: `${stats.opens.unique} unique / ${stats.opens.total} total`,
                  },
                  {
                    label: "Click Rate",
                    value: `${clickRate}%`,
                    icon: <MousePointer2 size={16} />,
                    sub: `${stats.clicks.unique} unique / ${stats.clicks.total} total`,
                  },
                ].map((s, i) => (
                  <Card key={i} className="p-4 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="text-xs font-medium uppercase tracking-wider">
                        {s.label}
                      </span>
                      {s.icon}
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        s.color || "text-zinc-900"
                      }`}
                    >
                      {s.value}
                    </div>
                    {s.sub && (
                      <div className="text-[10px] text-zinc-500">{s.sub}</div>
                    )}
                  </Card>
                ))}
              </div>

              <WebhookInfo
                campaignId={campaign.id}
                sampleData={campaign.variablesSchema}
                hasLocales={
                  !!campaign.localeTemplates &&
                  Object.keys(campaign.localeTemplates).length > 0
                }
              />
            </div>

            <div className="space-y-6">
              <TriggerConfigurationCard
                campaign={campaign}
                project={project}
                template={template}
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
              <DeliveryLogs campaignId={campaign.id} />
            </section>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab
            campaignId={campaign.id}
            totalDelivered={stats.delivered}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
