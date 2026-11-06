import { IMailer, SendMailOptions, SendMailResult } from "../../ports";

export interface MailjetConfig {
  apiKey: string;
  apiSecret: string;
  /** US for an account on Mailjet's US infrastructure. */
  region?: "GLOBAL" | "US";
}

interface MailjetAddress {
  Email: string;
  Name?: string;
}

/** `Name <a@b.c>` or a bare address, as Mailjet's `{ Email, Name }`. */
export function parseMailjetAddress(value: string): MailjetAddress {
  const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(value);
  if (!match) return { Email: value.trim() };
  const name = match[1].replace(/^"(.*)"$/, "$1").trim();
  return name ? { Email: match[2].trim(), Name: name } : { Email: match[2].trim() };
}

/**
 * The message id as a string. Mailjet's numeric `MessageID` is often above
 * 2^53 and loses digits in `JSON.parse`; `MessageUUID` is a string and is
 * what webhook events carry as `Message_GUID`.
 */
function readMessageId(data: any): string | undefined {
  const to = data?.Messages?.[0]?.To?.[0];
  if (typeof to?.MessageUUID === "string" && to.MessageUUID) return to.MessageUUID;
  // Fallback: the id at the end of MessageHref, as written by Mailjet.
  const href = typeof to?.MessageHref === "string" ? to.MessageHref : "";
  return /\/(\d+)$/.exec(href)?.[1];
}

function readError(data: any, status: number): string {
  const errors = data?.Messages?.[0]?.Errors;
  if (Array.isArray(errors)) {
    const messages = errors.map((e: { ErrorMessage?: string }) => e?.ErrorMessage).filter(Boolean);
    if (messages.length) return messages.join("; ");
  }
  if (typeof data?.ErrorMessage === "string" && data.ErrorMessage) return data.ErrorMessage;
  return `Mailjet API error (status ${status})`;
}

/**
 * Mailjet Send API v3.1. Tags go out as `EventPayload` (JSON), which
 * Mailjet hands back as `Payload` on every webhook event; that is how a
 * webhook finds its project.
 *
 * Mailjet's open and click tracking are switched off: Senlo adds its own
 * tracking pixel and tracked links, and Mailjet's would rewrite the links a
 * second time and count twice.
 */
export class MailjetMailer implements IMailer {
  private readonly url: string;

  constructor(private readonly config: MailjetConfig) {
    const host = config.region === "US" ? "api.us.mailjet.com" : "api.mailjet.com";
    this.url = `https://${host}/v3.1/send`;
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " + btoa(`${this.config.apiKey}:${this.config.apiSecret}`),
        },
        body: JSON.stringify({
          Messages: [
            {
              From: parseMailjetAddress(options.from),
              To: [parseMailjetAddress(options.to)],
              ReplyTo: options.replyTo ? parseMailjetAddress(options.replyTo) : undefined,
              Subject: options.subject,
              TextPart: options.text,
              HTMLPart: options.html,
              Headers: options.headers,
              EventPayload: options.tags ? JSON.stringify(options.tags) : undefined,
              TrackOpens: "disabled",
              TrackClicks: "disabled",
            },
          ],
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore parse error
      }

      // A 200 can still carry a per-message error.
      const status = data?.Messages?.[0]?.Status;
      if (!res.ok || (status && status !== "success")) {
        return { success: false, error: readError(data, res.status) };
      }

      return { success: true, messageId: readMessageId(data) };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Unknown error",
      };
    }
  }
}
