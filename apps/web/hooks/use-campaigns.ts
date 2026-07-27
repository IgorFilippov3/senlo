import { useState, useEffect, useMemo, useCallback } from "react";
import { Campaign, CampaignStatus } from "@senlo/core";
import { listAllCampaigns } from "../app/(app)/workspace/[id]/triggers/actions";

export interface CampaignFilters {
  projectId?: number;
  status?: CampaignStatus;
  search?: string;
  type?: "STANDARD" | "TRIGGERED";
}

export interface UseCampaignsOptions {
  filters?: CampaignFilters;
  enabled?: boolean;
}

/**
 * Hook for loading and filtering campaigns
 *
 * @param options - Configuration options for filtering and loading
 * @returns Object with campaigns data, loading state, error state, and filtering functions
 */
export function useCampaigns(options: UseCampaignsOptions = {}) {
  const { filters = {}, enabled = true } = options;

  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all campaigns once
  useEffect(() => {
    if (!enabled) return;

    const loadCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await listAllCampaigns();

        if (result.success) {
          setAllCampaigns(result.data);
        } else {
          setError(result.error.message);
          setAllCampaigns([]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load campaigns"
        );
        setAllCampaigns([]);
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, [enabled]);

  // Filter campaigns based on current filters
  const campaigns = useMemo(() => {
    let filtered = [...allCampaigns];

    // Apply filters in order
    if (filters.projectId !== undefined) {
      filtered = filtered.filter(campaign => campaign.projectId === filters.projectId);
    }

    if (filters.status) {
      filtered = filtered.filter(campaign => campaign.status === filters.status);
    }

    if (filters.type) {
      filtered = filtered.filter(campaign => campaign.type === filters.type);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchLower) ||
        (campaign.description && campaign.description.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, [allCampaigns, filters.projectId, filters.status, filters.type, filters.search]);

  // Utility functions for filtering
  const setFilters = (newFilters: Partial<CampaignFilters>) => {
    // This would need to be implemented if we want to update filters dynamically
    // For now, filters are passed as props
  };

  const refetch = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const result = await listAllCampaigns();

      if (result.success) {
        setAllCampaigns(result.data);
      } else {
        setError(result.error.message);
        setAllCampaigns([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
      setAllCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Optimistic updates
  const addCampaignOptimistic = useCallback((newCampaign: Campaign) => {
    setAllCampaigns(prev => [...prev, newCampaign]);
  }, []);

  const updateCampaignOptimistic = useCallback((campaignId: number, updates: Partial<Campaign>) => {
    setAllCampaigns(prev => 
      prev.map(campaign => 
        campaign.id === campaignId ? { ...campaign, ...updates } : campaign
      )
    );
  }, []);

  const removeCampaignOptimistic = useCallback((campaignId: number) => {
    setAllCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId));
  }, []);

  return {
    campaigns,
    allCampaigns,
    loading,
    error,
    refetch,
    // Computed values
    totalCount: allCampaigns.length,
    filteredCount: campaigns.length,
    // Status counts
    draftCount: allCampaigns.filter((c) => c.status === "DRAFT").length,
    scheduledCount: allCampaigns.filter((c) => c.status === "SCHEDULED").length,
    sendingCount: allCampaigns.filter((c) => c.status === "SENDING").length,
    completedCount: allCampaigns.filter((c) => c.status === "COMPLETED").length,
    cancelledCount: allCampaigns.filter((c) => c.status === "CANCELLED").length,
    archivedCount: allCampaigns.filter((c) => c.status === "ARCHIVED").length,
    // Optimistic update methods
    addCampaignOptimistic,
    updateCampaignOptimistic,
    removeCampaignOptimistic,
  };
}
