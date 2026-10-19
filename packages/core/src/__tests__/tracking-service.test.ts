import { describe, it, expect, vi } from "vitest";
import { TrackingService } from "../services/trackingService";
import { sealTrackingToken, clickSignature } from "../tracking-token";
import type { Campaign } from "../domain";
import type { EmailTemplate } from "../emailTemplate";

const SECRET = "s";
const campaign = { id: 42, projectId: 1, templateId: 10, localeTemplates: { de: 11 } } as unknown as Campaign;
const templates: Record<number, EmailTemplate> = {
  10: { id: 10, projectId: 1, html: '<a href="https://ok.test/a?x=1&amp;y=2">x</a>' } as EmailTemplate,
  11: { id: 11, projectId: 2, html: '<a href="https://foreign.test/">x</a>' } as EmailTemplate,
};
const repos = {
  campaigns: { findById: async (id: number) => (id === 42 ? campaign : null), logEvent: vi.fn(async (e: unknown) => e as never) },
  templates: { findById: async (id: number) => templates[id] ?? null },
};
const service = new TrackingService(repos, { linkSigningSecret: SECRET });

describe("TrackingService", () => {
  it("resolves sealed tokens and signed destinations only", async () => {
    const token = await sealTrackingToken({ campaignId: 42, email: "a@b.co" }, SECRET);
    const url = "https://ok.test/a";
    const s = await clickSignature(token, url, SECRET);
    expect(await service.resolveClick(token, url, s)).toEqual({ follow: true, campaignId: 42, email: "a@b.co" });
    expect(await service.resolveClick(token, "https://evil.test/", s)).toEqual({ follow: false });
    expect(await service.resolveClick("forged", url, s)).toEqual({ follow: false });
    expect(await service.resolveOpen(token)).toEqual({ campaignId: 42, email: "a@b.co" });
    expect(await service.resolveOpen("forged")).toBeNull();
  });

  it("vouches for a legacy click only when the URL stands in the campaign's own templates", async () => {
    expect(await service.isLegacyClickTarget(42, "https://ok.test/a?x=1&y=2")).toBe(true);
    expect(await service.isLegacyClickTarget(42, "https://foreign.test/")).toBe(false);
    expect(await service.isLegacyClickTarget(42, "https://other.test/")).toBe(false);
    expect(await service.isLegacyClickTarget(42, "javascript:alert(1)")).toBe(false);
    expect(await service.isLegacyClickTarget(7, "https://ok.test/a?x=1&y=2")).toBe(false);
  });

  it("records opens and clicks without throwing", async () => {
    repos.campaigns.logEvent.mockRejectedValueOnce(new Error("db down"));
    expect(await service.trackOpen(42, "a@b.co", { userAgent: "ua", ip: "ip" })).toEqual({ success: false, error: "db down" });
    expect(await service.trackClick(42, "a@b.co", "https://ok.test/a", { userAgent: "ua", ip: "ip" })).toEqual({ success: true });
    expect(repos.campaigns.logEvent).toHaveBeenLastCalledWith({ campaignId: 42, email: "a@b.co", type: "CLICK", linkUrl: "https://ok.test/a", metadata: { userAgent: "ua", ip: "ip" } });
  });
});
