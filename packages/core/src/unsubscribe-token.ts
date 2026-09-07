export interface UnsubscribeTokenData {
  /**
   * Present for campaign sends, where the recipient is a known contact.
   * Triggered sends can go to an address that has no contact row, so the
   * token carries the project and the address instead.
   */
  contactId?: number;
  projectId?: number;
  email?: string;
  campaignId: number;
}

export function encodeUnsubscribeToken(data: UnsubscribeTokenData): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString("base64url");
}

export function decodeUnsubscribeToken(
  token: string,
): UnsubscribeTokenData | null {
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    const data = JSON.parse(json) as UnsubscribeTokenData;

    if (!data || typeof data !== "object") return null;
    if (typeof data.campaignId !== "number") return null;
    // Tokens issued before triggered sends had an unsubscribe link carry only
    // a contact id, so either identifier is enough.
    if (data.contactId === undefined && !data.email) return null;

    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Headers Gmail and Yahoo require from bulk senders: a one-click unsubscribe
 * that never asks the recipient to log in or confirm. The URL must accept a
 * POST, which is why it points at the API route rather than the page.
 */
export function buildUnsubscribeHeaders(
  oneClickUrl?: string,
): Record<string, string> | undefined {
  if (!oneClickUrl) return undefined;

  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** The page a recipient lands on, and the endpoint one-click posts to. */
export function unsubscribeUrls(baseUrl: string, token: string) {
  return {
    page: `${baseUrl}/unsubscribe/${token}`,
    oneClick: `${baseUrl}/api/unsubscribe/${token}`,
  };
}
