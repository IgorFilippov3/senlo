import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { KEY_VALID, checkKeyOverHttp, isPermanentHttpStatus, keyInvalid } from "./keyCheck";

export interface CloudflareConfig {
  accountId: string;
  /** An API token allowed to send email for the account. */
  apiToken: string;
}

/** A Cloudflare account id: 32 hex characters. It goes into the URL path. */
export const CLOUDFLARE_ACCOUNT_ID = /^[a-f0-9]{32}$/i;

interface CloudflareAddress {
  address: string;
  name?: string;
}

/** `Name <a@b.c>` or a bare address: a string, or `{ address, name }` with a name. */
export function parseCloudflareAddress(value: string): string | CloudflareAddress {
  const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(value);
  if (!match) return value.trim();
  const name = match[1].replace(/^"(.*)"$/, "$1").trim();
  return name ? { address: match[2].trim(), name } : match[2].trim();
}

function bareAddress(value: string): string {
  const parsed = parseCloudflareAddress(value);
  return typeof parsed === "string" ? parsed : parsed.address;
}

/**
 * Cloudflare Email Service, REST API. Sending only: Cloudflare publishes
 * delivery events to Cloudflare Queues, not to a webhook, and neither the
 * REST response nor the events carry an id or tags Senlo could match, so
 * there is no delivery tracking.
 *
 * What the response does say, per recipient, is whether the message was
 * refused for good (`permanent_bounces`). That comes back as a successful
 * send with `permanentBounce`, not as an error: an error would make the
 * queue retry, and each retry is another hard bounce on the account.
 */
export class CloudflareMailer implements IMailer {
  private readonly url: string;

  constructor(private readonly config: CloudflareConfig) {
    if (!CLOUDFLARE_ACCOUNT_ID.test(config.accountId)) {
      throw new Error("Cloudflare account ID must be 32 hex characters");
    }
    this.url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`;
  }

  /**
   * Cloudflare's token check: `/user/tokens/verify` for a user token, then
   * `/accounts/{id}/tokens/verify` for an account-owned one. Refused by both:
   * the token is wrong.
   */
  async verify(): Promise<KeyCheck> {
    const headers = { Authorization: `Bearer ${this.config.apiToken}` };
    const read = (status: number, body: any) => {
      if (status >= 200 && status < 300) {
        const state = body?.result?.status;
        return state && state !== "active" ? keyInvalid(`This Cloudflare API token is ${state}`) : KEY_VALID;
      }
      return status === 401 || status === 403 ? keyInvalid("Cloudflare rejected the API token") : null;
    };
    const asUser = await checkKeyOverHttp("Cloudflare", "https://api.cloudflare.com/client/v4/user/tokens/verify", headers, read);
    if (asUser.status !== "invalid") return asUser;
    return checkKeyOverHttp(
      "Cloudflare",
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/tokens/verify`,
      headers,
      read,
    );
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiToken}`,
        },
        body: JSON.stringify({
          to: parseCloudflareAddress(options.to),
          from: parseCloudflareAddress(options.from),
          reply_to: options.replyTo ? bareAddress(options.replyTo) : undefined,
          subject: options.subject,
          html: options.html,
          text: options.text,
          headers: options.headers,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore parse error
      }

      if (!res.ok || data?.success !== true) {
        const messages = Array.isArray(data?.errors)
          ? data.errors
              .map((e: { code?: number; message?: string }) =>
                e?.message ? (e.code ? `${e.message} (${e.code})` : e.message) : null,
              )
              .filter(Boolean)
          : [];
        return {
          success: false,
          error: messages.length ? messages.join("; ") : `Cloudflare API error (status ${res.status})`,
          permanent: !res.ok && isPermanentHttpStatus(res.status),
        };
      }

      const bounced: unknown = data?.result?.permanent_bounces;
      const recipient = bareAddress(options.to).toLowerCase();
      const permanentBounce =
        Array.isArray(bounced) &&
        bounced.some((a) => typeof a === "string" && a.toLowerCase() === recipient);

      return permanentBounce ? { success: true, permanentBounce: true } : { success: true };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Unknown error",
      };
    }
  }
}
