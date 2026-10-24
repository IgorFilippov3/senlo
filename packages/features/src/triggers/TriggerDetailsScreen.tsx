// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CampaignDetails } from "@senlo/core/server";
import { useCampaignEvents, useCampaignLinkStats, useCampaignTimeSeries } from "../data/campaigns";
import { useSenloDialogs } from "../dialogs/registry";
import { useSenloNavigation } from "../layout/navigation-context";
import { DeliveryLogs, type DeliveryLogFilter } from "./DeliveryLogs";
import { DEFAULT_ANALYTICS_PERIOD, TriggerAnalytics, type AnalyticsPeriod } from "./TriggerAnalytics";
import { TriggerDetailsView } from "./TriggerDetailsView";

const LOGS_PAGE_SIZE = 30;
const POLL_INTERVAL_MS = 3000;
const POLL_FOR_MS = 120_000;

export interface TriggerDetailsScreenProps {
  /** Loaded on the server (`CampaignService.getDetails`): the page is rendered with its stats. */
  details: CampaignDetails;
  /** Full URL of the send endpoint, from the server's configured app URL. */
  apiEndpointUrl: string;
  /** Sender address used when the trigger sets none (server config). */
  defaultFromEmail: string;
}

/** One trigger: configuration, API snippet, delivery logs, analytics. */
export function TriggerDetailsScreen({ details, apiEndpointUrl, defaultFromEmail }: TriggerDetailsScreenProps) {
  const { campaign, project, template, stats } = details;
  const { paths, renderLink } = useSenloNavigation();
  const { open: openDialog } = useSenloDialogs();
  useRefreshWhileSending(campaign.status);

  return (
    <TriggerDetailsView
      campaign={campaign}
      project={project}
      template={template}
      stats={stats}
      apiEndpointUrl={apiEndpointUrl}
      defaultFromEmail={defaultFromEmail}
      renderBackLink={(children) => renderLink(paths.triggers(project.id), children, "")}
      renderTemplateLink={(templateId, children) =>
        renderLink(paths.editor(templateId, { campaignId: campaign.id }), children, "block")
      }
      onEdit={() => openDialog("EDIT_TRIGGER_CONFIG", { campaign, project, template })}
      deliveryLogs={<TriggerDeliveryLogs campaignId={campaign.id} />}
      analytics={<TriggerAnalyticsTab campaignId={campaign.id} totalDelivered={stats.delivered} />}
    />
  );
}

/** Server-rendered stats go stale while a send runs; refresh them for a while. */
function useRefreshWhileSending(status: string) {
  const { refresh } = useSenloNavigation();
  // The latest `refresh` (it changes with the path); only the status restarts the polling.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (status !== "SENDING" && status !== "COMPLETED") return;
    const interval = setInterval(() => refreshRef.current(), POLL_INTERVAL_MS);
    const timeout = setTimeout(() => clearInterval(interval), POLL_FOR_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status]);
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

function TriggerAnalyticsTab({ campaignId, totalDelivered }: { campaignId: number; totalDelivered: number }) {
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
