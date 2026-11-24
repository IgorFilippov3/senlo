import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { authStatus, checkKeyOverHttp, isPermanentHttpStatus } from "./keyCheck";

export interface SparkPostConfig {
  apiKey: string;
  /** EU for a SparkPost account on EU infrastructure (`api.eu.sparkpost.com`). */
  region?: "US" | "EU";
}

/**
 * SparkPost (Bird) Transmissions API v1. Tags go out as transmission `metadata`
 * so a future batched webhook adapter can match events to a project.
 *
 * SparkPost's own open and click tracking are switched off: Senlo adds its
 * own tracking pixel and tracked links.
 */
export class SparkPostMailer implements IMailer {
  private readonly host: string;
  private readonly url: string;

  constructor(private readonly config: SparkPostConfig) {
    this.host = config.region === "EU" ? "api.eu.sparkpost.com" : "api.sparkpost.com";
    this.url = `https://${this.host}/api/v1/transmissions`;
  }

  /** `GET /api/v1/sending-domains`: checks whether the API key is accepted for this region. */
  verify(): Promise<KeyCheck> {
    return checkKeyOverHttp(
      "SparkPost",
      `https://${this.host}/api/v1/sending-domains`,
      { Authorization: this.config.apiKey },
      (status, body) =>
        authStatus(
          "SparkPost",
          status,
          body?.errors?.[0]?.description || body?.errors?.[0]?.message,
        ),
    );
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: this.config.apiKey,
        },
        body: JSON.stringify({
          recipients: [{ address: options.to }],
          content: {
            from: options.from,
            subject: options.subject,
            html: options.html,
            text: options.text,
            reply_to: options.replyTo,
            headers: options.headers,
          },
          metadata: options.tags,
          options: {
            open_tracking: false,
            click_tracking: false,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const messages = Array.isArray(data?.errors)
          ? data.errors
              .map((e: { message?: string; description?: string }) => e?.description || e?.message)
              .filter(Boolean)
          : [];
        const error =
          messages.length > 0
            ? messages.join("; ")
            : `SparkPost API error (status ${res.status})`;
        return {
          success: false,
          error,
          permanent: isPermanentHttpStatus(res.status),
        };
      }

      return {
        success: true,
        messageId: data?.results?.id,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Unknown error",
      };
    }
  }
}
