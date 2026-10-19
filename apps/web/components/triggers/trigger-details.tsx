"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CampaignDetails } from "@senlo/core/server";
import {
  DEFAULT_ANALYTICS_PERIOD,
  DeliveryLogs,
  TriggerAnalytics,
  TriggerDetailsView,
  type AnalyticsPeriod,
  type DeliveryLogFilter,
} from "@senlo/features";
import {
  useCampaignEvents,
  useCampaignLinkStats,
  useCampaignTimeSeries,
} from "apps/web/queries/campaigns";
import { useDialogStore } from "apps/web/providers/dialogs/store";

const LOGS_PAGE_SIZE = 30;
const POLL_INTERVAL_MS = 3000;
const POLL_FOR_MS = 120_000;

interface TriggerDetailsProps {
  details: CampaignDetails;
  apiEndpointUrl: string;
  defaultFromEmail: string;
}

export function TriggerDetails({ details, apiEndpointUrl, defaultFromEmail }: TriggerDetailsProps) {
  const { campaign, project, template, stats } = details;
  const openDialog = useDialogStore((state) => state.open);
  useRefreshWhileSending(campaign.status);

  return (
    <TriggerDetailsView
      campaign={campaign}
      project={project}
      template={template}
      stats={stats}
      apiEndpointUrl={apiEndpointUrl}
      defaultFromEmail={defaultFromEmail}
      renderBackLink={(children) => (
        <Link href={`/workspace/${project.id}/triggers`}>{children}</Link>
      )}
      renderTemplateLink={(templateId, children) => (
        <Link href={`/editor/${templateId}?campaignId=${campaign.id}`} className="block">
          {children}
        </Link>
      )}
      onEdit={() => openDialog("EDIT_TRIGGER_CONFIG", { campaign, project, template })}
      deliveryLogs={<TriggerDeliveryLogs campaignId={campaign.id} />}
      analytics={<TriggerAnalyticsTab campaignId={campaign.id} totalDelivered={stats.delivered} />}
    />
  );
}

/** Server-rendered stats go stale while a send runs; refresh them for a while. */
function useRefreshWhileSending(status: string) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "SENDING" && status !== "COMPLETED") return;
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    const timeout = setTimeout(() => clearInterval(interval), POLL_FOR_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, router]);
}

function TriggerDeliveryLogs({ campaignId }: { campaignId: number }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<DeliveryLogFilter>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useCampaignEvents(campaignId, {
    page,
    pageSize: LOGS_PAGE_SIZE,
    type: filter === "ALL" ? undefined : filter,
    search: search || undefined,
  });

  return (
    <DeliveryLogs
      events={data?.events ?? []}
      total={data?.total ?? 0}
      isLoading={isLoading}
      error={error?.message}
      page={page}
      pageSize={LOGS_PAGE_SIZE}
      filter={filter}
      onPageChange={setPage}
      onFilterChange={(next) => {
        setFilter(next);
        setPage(1);
      }}
      onSearchChange={(next) => {
        setSearch(next);
        setPage(1);
      }}
    />
  );
}

function TriggerAnalyticsTab({
  campaignId,
  totalDelivered,
}: {
  campaignId: number;
  totalDelivered: number;
}) {
  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_ANALYTICS_PERIOD);
  const timeSeries = useCampaignTimeSeries(campaignId, period);
  const linkStats = useCampaignLinkStats(campaignId);

  return (
    <TriggerAnalytics
      period={period}
      onPeriodChange={setPeriod}
      timeSeries={timeSeries.data}
      isTimeSeriesLoading={timeSeries.isLoading}
      linkStats={linkStats.data}
      isLinkStatsLoading={linkStats.isLoading}
      totalDelivered={totalDelivered}
    />
  );
}
