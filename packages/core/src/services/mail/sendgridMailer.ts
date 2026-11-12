import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { KEY_VALID, authStatus, checkKeyOverHttp, isPermanentHttpStatus, keyInvalid } from "./keyCheck";

export interface SendGridConfig {
  apiKey: string;
  /** EU for a SendGrid account or subuser with EU data residency. */
  region?: "US" | "EU";
}

interface SendGridAddress {
  email: string;
  name?: string;
}

/** `Name <a@b.c>` or a bare address, as SendGrid's `{ email, name }`. */
export function parseSendGridAddress(value: string): SendGridAddress {
  const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(value);
  if (!match) return { email: value.trim() };
  const name = match[1].replace(/^"(.*)"$/, "$1").trim();
  return name ? { email: match[2].trim(), name } : { email: match[2].trim() };
}

/**
 * SendGrid v3 Mail Send. Tags go out as `custom_args`, which SendGrid copies
 * onto every Event Webhook event; that is how a webhook finds its project.
 *
 * SendGrid's own open, click and subscription tracking are switched off:
 * Senlo adds its own tracking pixel, tracked links and unsubscribe headers,
 * and SendGrid's would rewrite the links a second time and count twice.
 */
export class SendGridMailer implements IMailer {
  private readonly url: string;

  private readonly host: string;

  constructor(private readonly config: SendGridConfig) {
    this.host = config.region === "EU" ? "api.eu.sendgrid.com" : "api.sendgrid.com";
    this.url = `https://${this.host}/v3/mail/send`;
  }

  /**
   * `GET /v3/scopes`: every key may list its own permissions. A key that
   * works but lacks `mail.send` cannot send, so it is refused too.
   */
  verify(): Promise<KeyCheck> {
    return checkKeyOverHttp(
      "SendGrid",
      `https://${this.host}/v3/scopes`,
      { Authorization: `Bearer ${this.config.apiKey}` },
      (status, body) => {
        if (status >= 200 && status < 300) {
          const scopes: unknown = body?.scopes;
          return Array.isArray(scopes) && !scopes.includes("mail.send")
            ? keyInvalid("This SendGrid API key has no Mail Send permission")
            : KEY_VALID;
        }
        return authStatus("SendGrid", status, body?.errors?.[0]?.message);
      },
    );
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      // text/plain has to come before text/html.
      const content = [
        ...(options.text ? [{ type: "text/plain", value: options.text }] : []),
        { type: "text/html", value: options.html },
      ];

      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [parseSendGridAddress(options.to)],
              custom_args: options.tags,
            },
          ],
          from: parseSendGridAddress(options.from),
          reply_to: options.replyTo ? parseSendGridAddress(options.replyTo) : undefined,
          subject: options.subject,
          content,
          headers: options.headers,
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false },
            open_tracking: { enable: false },
            subscription_tracking: { enable: false },
          },
        }),
      });

      if (!res.ok) {
        let error = `SendGrid API error (status ${res.status})`;
        try {
          const data = await res.json();
          const messages = Array.isArray(data?.errors)
            ? data.errors.map((e: { message?: string }) => e?.message).filter(Boolean)
            : [];
          if (messages.length) error = messages.join("; ");
        } catch {
          // ignore parse error
        }
        return { success: false, error, permanent: isPermanentHttpStatus(res.status) };
      }

      // 202 with an empty body; the id is in a header.
      return {
        success: true,
        messageId: res.headers.get("x-message-id") ?? undefined,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Unknown error",
      };
    }
  }
}
