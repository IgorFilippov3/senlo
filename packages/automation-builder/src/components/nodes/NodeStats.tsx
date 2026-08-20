import React from "react";
import { useAutomationStore } from "../../store/automationStore";
import { Users, CheckCircle, XCircle, Clock } from "lucide-react";

interface NodeStatsProps {
  nodeId: string;
}

export const NodeStats = ({ nodeId }: NodeStatsProps) => {
  const stats = useAutomationStore((state) => state.nodeStats[nodeId]);

  if (!stats) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-4 text-[10px] font-bold">
      <div
        className="flex items-center gap-1 text-gray-500"
        title="Total contacts"
      >
        <Users size={12} />
        <span>{stats.total}</span>
      </div>
      {stats.active > 0 && (
        <div
          className="flex items-center gap-1 text-purple-600"
          title="Active contacts (waiting)"
        >
          <Clock size={12} />
          <span>{stats.active}</span>
        </div>
      )}
      {stats.completed > 0 && (
        <div
          className="flex items-center gap-1 text-green-600"
          title="Completed"
        >
          <CheckCircle size={12} />
          <span>{stats.completed}</span>
        </div>
      )}
      {stats.failed > 0 && (
        <div className="flex items-center gap-1 text-red-600" title="Failed">
          <XCircle size={12} />
          <span>{stats.failed}</span>
        </div>
      )}
    </div>
  );
};
