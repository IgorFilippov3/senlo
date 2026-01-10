import { notFound } from "next/navigation";
import { getCampaignDetails } from "../actions";
import { PageHeader, Card, Badge } from "@senlo/ui";
import {
  Send,
  Mail,
  Eye,
  MousePointer2,
  Zap,
  Terminal,
  ArrowLeft,
  BarChart3,
  Users,
} from "lucide-react";
import Link from "next/link";
import { CampaignTimeline } from "./campaign-timeline";
import { SendCampaignButton } from "./send-button";
import { WebhookInfo } from "./webhook-info";
import { CampaignInfoCard } from "./campaign-info-card";
import { CampaignPolling } from "./campaign-polling";

interface CampaignDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailsPage({
  params,
}: CampaignDetailsPageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (isNaN(id)) return notFound();

  const details = await getCampaignDetails(id);
  if (!details) return notFound();

  const { campaign, project, template, list, events, triggeredLogs } = details;

  const isTriggered = campaign.type === "TRIGGERED";

  const getUniqueCount = (type: string) => {
    const emails = events
      .filter((e) => e.type === type)
      .map((e) => e.email.toLowerCase());
    return new Set(emails).size;
  };

  const stats = isTriggered
    ? {
        sent: triggeredLogs.filter((l) => l.status === "SUCCESS").length,
        delivered: triggeredLogs.filter((l) => l.status === "SUCCESS").length,
        uniqueOpens: getUniqueCount("OPEN"),
        totalOpens: events.filter((e) => e.type === "OPEN").length,
        uniqueClicks: getUniqueCount("CLICK"),
        totalClicks: events.filter((e) => e.type === "CLICK").length,
        errors: triggeredLogs.filter((l) => l.status === "FAILED").length,
      }
    : {
        sent: events.filter((e) => e.type === "SENT").length,
        delivered: events.filter((e) => e.type === "DELIVERED").length,
        uniqueOpens: getUniqueCount("OPEN"),
        totalOpens: events.filter((e) => e.type === "OPEN").length,
        uniqueClicks: getUniqueCount("CLICK"),
        totalClicks: events.filter((e) => e.type === "CLICK").length,
      };

  const openRate =
    stats.sent > 0 ? Math.round((stats.uniqueOpens / stats.sent) * 100) : 0;
  const clickRate =
    stats.sent > 0 ? Math.round((stats.uniqueClicks / stats.sent) * 100) : 0;

  return (
    <main className="max-w-6xl mx-auto py-10 px-8">
      <CampaignPolling campaignId={campaign.id} status={campaign.status} />
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/campaigns"
          className="text-sm text-zinc-500 hover:text-zinc-800 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Campaigns
        </Link>

        {isTriggered && (
          <Badge
            variant="secondary"
            className="flex items-center gap-1.5 px-3 py-1"
          >
            <Zap size={14} className="text-blue-600 fill-blue-600" />
            Triggered Campaign
          </Badge>
        )}
      </div>

      <PageHeader
        title={campaign.name}
        description={
          campaign.description ||
          (isTriggered
            ? "API-driven campaign. Emails are sent automatically via webhook."
            : "View campaign performance and event timeline.")
        }
        actions={
          <div className="flex items-center gap-3">
            <Badge
              variant={
                campaign.status === "COMPLETED" ? "success" : "secondary"
              }
              className="py-1.5 px-3"
            >
              {isTriggered ? "ACTIVE" : campaign.status}
            </Badge>
            {!isTriggered && campaign.status === "DRAFT" && (
              <SendCampaignButton campaignId={campaign.id} />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Sent", value: stats.sent, icon: <Send size={16} /> },
              {
                label: isTriggered ? "Errors" : "Delivered",
                value: isTriggered ? stats.errors : stats.delivered,
                icon: isTriggered ? <Terminal size={16} /> : <Mail size={16} />,
                color:
                  isTriggered && stats.errors! > 0 ? "text-red-500" : undefined,
              },
              {
                label: "Open Rate",
                value: `${openRate}%`,
                icon: <Eye size={16} />,
                sub: `${stats.uniqueOpens} unique / ${stats.totalOpens} total`,
              },
              {
                label: "Click Rate",
                value: `${clickRate}%`,
                icon: <MousePointer2 size={16} />,
                sub: `${stats.uniqueClicks} unique / ${stats.totalClicks} total`,
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
                  className={`text-2xl font-bold ${s.color || "text-zinc-900"}`}
                >
                  {s.value}
                </div>
                {s.sub && (
                  <div className="text-[10px] text-zinc-500">{s.sub}</div>
                )}
              </Card>
            ))}
          </div>

          {isTriggered && (
            <WebhookInfo
              campaignId={campaign.id}
              sampleData={campaign.variablesSchema}
            />
          )}

          <section className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 size={20} className="text-zinc-400" />
              {isTriggered ? "Recent Activity" : "Campaign Results"}
            </h3>
            <CampaignTimeline events={events} />
          </section>
        </div>

        <div className="space-y-6">
          <CampaignInfoCard
            campaign={campaign}
            project={project}
            template={template}
          />

          {!isTriggered && list && (
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2 border-b border-zinc-100 pb-4">
                <Users size={18} className="text-zinc-400" />
                Audience
              </h3>
              <div className="flex flex-col gap-2 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                <div className="flex items-center gap-2 text-sm">
                  <Users size={16} className="text-zinc-400" />
                  <span className="font-medium text-zinc-900">{list.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal text-xs">
                    {list.contactCount} contacts
                  </Badge>
                  <Link
                    href={`/audience?projectId=${project.id}&listId=${list.id}`}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    Manage contacts →
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
