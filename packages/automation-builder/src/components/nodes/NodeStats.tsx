import React from "react";
import { CheckCircle2, Clock, Users, XCircle } from "lucide-react";
import { useAutomationStore } from "../../store/automationStore";

/**
 * The live counts strip at the bottom of a step card. Its height is
 * `STATS_HEIGHT` in the layout: keep them in step.
 */
export const NodeStats = ({ nodeId }: { nodeId: string }) => {
  const stats = useAutomationStore((state) => state.nodeStats[nodeId]);
  if (!stats) return null;

  return (
    <div className="flex h-7 items-center gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50/70 px-4 text-[11px] font-medium tabular-nums text-gray-600">
      <span className="flex items-center gap-1" title="Contacts that reached this step">
        <Users size={12} className="text-gray-400" />
        {stats.total}
      </span>
      {stats.active > 0 && (
        <span className="flex items-center gap-1" title="Waiting here">
          <Clock size={12} className="text-violet-500" />
          {stats.active}
        </span>
      )}
      {stats.completed > 0 && (
        <span className="flex items-center gap-1" title="Completed">
          <CheckCircle2 size={12} className="text-emerald-500" />
          {stats.completed}
        </span>
      )}
      {stats.failed > 0 && (
        <span className="flex items-center gap-1" title="Failed">
          <XCircle size={12} className="text-red-500" />
          {stats.failed}
        </span>
      )}
    </div>
  );
};
