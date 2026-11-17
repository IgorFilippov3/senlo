// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { authStatus, checkKeyOverHttp, isPermanentHttpStatus, keyLimited } from "./keyCheck";

export const GROUNDMAIL_API_URL = "https://api.groundmail.dev";

/**
 * Groundmail sends transactional mail and product mail (lifecycle, announcements)
 * from separate IP pools. An automation email goes out as `product`; a send
 * through the API and a test send as `transactional`. Read from `stream`, not
 * from the tags: a send through the API carries its trigger's campaign id too.
 */
export function groundmailCategory(options: SendMailOptions): "transactional" | "product" {
  return options.stream === "lifecycle" ? "product" : "transactional";
}

function hasHeader(headers: Record<string, string> | undefined, name: string): boolean {
  return !!headers && Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

export class GroundmailMailer implements IMailer {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = GROUNDMAIL_API_URL,
  ) {}

  /**
   * `GET /domains` needs the `domains:read` scope. A sending-only key gets 403
   * `insufficient_scope`: it still sends, so it is `limited`, not invalid. A
   * wrong or revoked key gets 401.
   */
  verify(): Promise<KeyCheck> {
    return checkKeyOverHttp(
      "Groundmail",
      `${this.baseUrl}/domains`,
      { Authorization: `Bearer ${this.apiKey}` },
      (status, body) =>
        body?.error?.code === "insufficient_scope"
          ? keyLimited("A sending-only key: Senlo cannot read your domains with it, sending is not affected")
          : authStatus("Groundmail", status, body?.error?.message),
    );
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    const category = groundmailCategory(options);
    try {
      const res = await fetch(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Senlo",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: options.from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
          headers: options.headers,
          tags: options.tags,
          category,
          // Product mail gets Groundmail's own unsubscribe link unless the
          // message already has one. Senlo's List-Unsubscribe points at its
          // own unsubscribe endpoint, so keep it and don't add a second one.
          unsubscribe:
            category === "product" && hasHeader(options.headers, "List-Unsubscribe") ? false : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.error?.message || `Groundmail API error (status ${res.status})`;
        return {
          success: false,
          error: data?.error?.code ? `${message} (${data.error.code})` : message,
          permanent: isPermanentHttpStatus(res.status),
        };
      }

      return {
        success: true,
        messageId: data.id,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Unknown error",
      };
    }
  }
}
