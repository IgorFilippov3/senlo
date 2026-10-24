"use client";

import React, { useState, useEffect } from "react";
import { useSenloNavigation } from "@senlo/features";
import { Sidebar } from "./sidebar";

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { pathname, paths } = useSenloNavigation();

  useEffect(() => {
    setMounted(true);
  }, []);

  const hideSidebar = paths.hidesSidebar(pathname);

  // На сервере возвращаем минимальную структуру без сайдбара и лишних отступов
  // Это предотвращает Hydration Mismatch
  if (!mounted) {
    return <div className="flex min-h-screen">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      {!hideSidebar && <Sidebar />}
      <div className={`flex-1 ${!hideSidebar ? "pl-64" : ""}`}>{children}</div>
    </div>
  );
}
