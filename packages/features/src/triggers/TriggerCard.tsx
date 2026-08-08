"use client";

import React, { memo } from "react";
import { Card, Badge } from "@senlo/ui";
import type { Campaign } from "@senlo/core";
import { Send, Calendar, Trash2, BarChart2, Clock, Zap } from "lucide-react";

export interface TriggerCardProps {
  campaign: Campaign;
  onDelete?: (campaign: Campaign) => void;
  renderLink?: (
    projectId: number,
    campaignId: number,
    children: React.ReactNode,
  ) => React.ReactNode;
}

const statusColors: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "error"
> = {
  DRAFT: "secondary",
  SCHEDULED: "warning",
  SENDING: "default",
  COMPLETED: "success",
  CANCELLED: "error",
  ARCHIVED: "secondary",
};

export const TriggerCard = memo(function TriggerCard({
  campaign,
  onDelete,
  renderLink,
}: TriggerCardProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(campaign);
  };

  const isTriggered = campaign.type === "TRIGGERED";

  const cardContent = (
    <Card className="h-full p-5 transition-shadow hover:shadow-md border-zinc-200 group-hover:border-zinc-300">
      <div className="flex flex-col h-full gap-4">
        <div className="flex items-start justify-between">
          <div
            className={`p-2 rounded-lg transition-colors ${
              campaign.status === "COMPLETED"
                ? "bg-green-50 text-green-600"
                : isTriggered
                  ? "bg-blue-50 text-blue-600"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {isTriggered ? (
              <Zap size={20} className="fill-blue-600/20" />
            ) : (
              <Send size={20} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                isTriggered
                  ? "success"
                  : statusColors[campaign.status] || "default"
              }
            >
              {isTriggered ? "ACTIVE" : campaign.status}
            </Badge>
            <button
              onClick={handleDelete}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete trigger"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
              {campaign.name}
            </h3>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Clock size={14} />
              <span>
                Created:{" "}
                {campaign.createdAt instanceof Date
                  ? campaign.createdAt.toLocaleDateString("en-GB")
                  : String(campaign.createdAt)}
              </span>
            </div>
            {isTriggered ? (
              <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                <Zap size={14} />
                <span>API-Triggered</span>
              </div>
            ) : (
              campaign.sentAt && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Calendar size={14} />
                  <span>
                    Sent:{" "}
                    {campaign.sentAt instanceof Date
                      ? campaign.sentAt.toLocaleDateString("en-GB")
                      : String(campaign.sentAt)}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between text-sm font-medium">
          <span className="text-zinc-400 font-normal">
            Project ID: {campaign.projectId}
          </span>
          <div className="flex items-center text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
            View Analytics
            <BarChart2 size={14} className="ml-1" />
          </div>
        </div>
      </div>
    </Card>
  );

  if (renderLink) {
    return renderLink(campaign.projectId, campaign.id, cardContent);
  }

  return <div className="group relative">{cardContent}</div>;
});
