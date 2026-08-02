import { ICampaignRepository } from "../ports";

export interface TrackingMetadata {
  userAgent: string;
  ip: string;
}

export class TrackingService {
  constructor(private readonly campaignRepo: ICampaignRepository) {}

  /**
   * Records an email open event.
   */
  async trackOpen(campaignId: number, email: string, metadata: TrackingMetadata) {
    try {
      await this.campaignRepo.logEvent({
        campaignId,
        email,
        type: "OPEN",
        metadata: {
          userAgent: metadata.userAgent,
          ip: metadata.ip,
        },
      });
      return { success: true };
    } catch (error) {
      // We catch it here to allow callers to handle it as non-critical
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Records a link click event.
   */
  async trackClick(
    campaignId: number, 
    email: string, 
    linkUrl: string, 
    metadata: TrackingMetadata
  ) {
    try {
      await this.campaignRepo.logEvent({
        campaignId,
        email,
        type: "CLICK",
        linkUrl,
        metadata: {
          userAgent: metadata.userAgent,
          ip: metadata.ip,
        },
      });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}
