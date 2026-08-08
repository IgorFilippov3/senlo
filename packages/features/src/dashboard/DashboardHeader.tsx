"use client";

import React from "react";

export interface DashboardHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export function DashboardHeader({
  title,
  description,
  actions,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        <p className="text-zinc-500 text-sm">{description}</p>
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
