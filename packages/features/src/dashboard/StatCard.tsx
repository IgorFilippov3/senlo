/* eslint-disable @typescript-eslint/no-explicit-2any */
"use client";

import React from "react";
import { Card, Badge } from "@senlo/ui";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
  description?: string;
  trend?: string;
  color?: "blue" | "green" | "purple" | "amber" | "rose";
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color = "blue",
}: StatCardProps) {
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
