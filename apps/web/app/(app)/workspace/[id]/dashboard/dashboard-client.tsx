/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  Loader2,
  TrendingUp,
  ShieldCheck,
  Mail,
  CheckCircle2,
  AlertCircle,
  MousePointer2,
  Eye,
  History,
  Zap,
} from "lucide-react";
import { Card, Badge } from "@senlo/ui";
import { useDashboardData } from "apps/web/queries/dashboard";

// --- Components ---

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color = "blue",
}: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  trend?: string;
  color?: "blue" | "green" | "purple" | "amber" | "rose";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <Card className="p-5 border-zinc-200">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg border ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <Badge
            variant="secondary"
            className="bg-zinc-100 text-zinc-600 border-zinc-200"
          >
            {trend}
          </Badge>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-zinc-900 tracking-tight">
          {value}
        </h3>
        {description && (
          <p className="text-xs text-zinc-400 mt-1">{description}</p>
        )}
      </div>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length && label) {
    const date = parseISO(label);
    return (
      <div className="bg-white p-3 border border-zinc-200 shadow-lg rounded-lg text-xs">
        <p className="font-bold mb-2 text-zinc-900">
          {format(date, "MMMM dd, yyyy")}
        </p>
        <div className="space-y-1">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-zinc-500">Sent:</span>
            <span className="font-bold text-zinc-900">
              {payload[0]?.value ?? 0}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-zinc-500">Suppressed:</span>
            <span className="font-bold text-zinc-900">
              {payload[1]?.value ?? 0}
            </span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// --- Main Component ---

export function DashboardClient({ projectId }: { projectId?: number }) {
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState(7);

  const { data, isLoading } = useDashboardData(projectId!, days, 8);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stats = data?.stats;
  const activity = data?.activity || [];
  const events = data?.events || [];

  if (!mounted || (isLoading && !stats)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  const openRate = stats?.totalSent
    ? ((stats.opened / stats.totalSent) * 100).toFixed(1)
    : "0.0";
  const clickRate = stats?.totalSent
    ? ((stats.clicked / stats.totalSent) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">System Dashboard</h1>
          <p className="text-zinc-500 text-sm">
            Overview of your email infrastructure performance.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg">
          {[7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                days === d
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Last {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sent"
          value={stats?.totalSent || 0}
          icon={Mail}
          color="blue"
          description="Emails attempted across all projects"
        />
        <StatCard
          title="Delivered"
          value={stats?.delivered || 0}
          icon={CheckCircle2}
          color="green"
          description="Successful deliveries"
          trend={`${stats?.totalSent ? ((stats.delivered / stats.totalSent) * 100).toFixed(1) : 0}% rate`}
        />
        <StatCard
          title="Bounced"
          value={stats?.bounced || 0}
          icon={AlertCircle}
          color="rose"
          description="Returned or rejected emails"
        />
        <StatCard
          title="Saved Sends"
          value={stats?.savedSends || 0}
          icon={ShieldCheck}
          color="amber"
          description="Intercepted by reputation protection"
          trend="Protected"
        />
      </div>

      {/* Engagement Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border-zinc-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Eye size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Average Open Rate
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-900">
                {openRate}%
              </span>
              <span className="text-xs text-zinc-400">
                {stats?.opened} unique opens
              </span>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-zinc-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <MousePointer2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Average Click Rate
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-900">
                {clickRate}%
              </span>
              <span className="text-xs text-zinc-400">
                {stats?.clicked} unique clicks
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Chart */}
        <Card className="lg:col-span-2 p-6 border-zinc-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500" />
              Email Activity
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-zinc-500">Sent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-zinc-500">Suppressed</span>
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={activity}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(t) => format(parseISO(t), "MMM dd")}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  minTickGap={30}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                />
                <Tooltip content={CustomTooltip} />
                <Line
                  type="monotone"
                  dataKey="success"
                  name="Sent"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="suppressed"
                  name="Suppressed"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Event Feed */}
        <Card className="p-6 border-zinc-200">
          <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-6">
            <History size={18} className="text-zinc-400" />
            Live Event Feed
          </h3>
          <div className="space-y-6">
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">
                No recent activity detected.
              </p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex gap-3 relative">
                  <div className="mt-1 shrink-0">
                    {event.type === "SUPPRESSION_ADDED" ? (
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                        <ShieldCheck size={14} />
                      </div>
                    ) : event.type === "BOUNCE" ||
                      event.type === "SPAM" ||
                      event.type === "FAILED" ? (
                      <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                        <AlertCircle size={14} />
                      </div>
                    ) : event.type === "CAMPAIGN_COMPLETED" ? (
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100">
                        <CheckCircle2 size={14} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <Zap size={14} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">
                      {event.description}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1 font-medium uppercase tracking-wider">
                      {format(new Date(event.occurredAt), "HH:mm · MMM dd")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
