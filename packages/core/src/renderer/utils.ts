export function renderPadding(padding?: any): string {
  if (!padding) return "0px 0px 0px 0px";
  return `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px`;
}

export function normalizeUrl(url: string, baseUrl?: string): string {
  if (!url || !baseUrl) return url || "";
  if (url.startsWith("/") && baseUrl) {
    // Remove trailing slash from baseUrl if present
    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}${url}`;
  }
  return url;
}









