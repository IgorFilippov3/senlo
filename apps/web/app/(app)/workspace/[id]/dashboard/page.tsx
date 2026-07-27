// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from "react";
import { DashboardClient } from "./dashboard-client";

export const metadata = {
  title: "Dashboard | Senlo",
  description: "System performance and reputation protection overview",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <DashboardClient projectId={projectId} />
    </div>
  );
}
