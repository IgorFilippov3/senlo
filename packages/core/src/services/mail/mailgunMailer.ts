import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { KEY_VALID, checkKeyOverHttp, isPermanentHttpStatus, keyInvalid, keyUnknown } from "./keyCheck";

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  region?: "US" | "EU";
}

export class MailgunMailer implements IMailer {
  private readonly baseUrl: string;
  private readonly host: string;

  constructor(private readonly config: MailgunConfig) {
    // EU region uses api.eu.mailgun.net, US uses api.mailgun.net
    this.host =
      config.region?.toUpperCase() === "EU" ? "api.eu.mailgun.net" : "api.mailgun.net";
    this.baseUrl = `https://${this.host}/v3/${config.domain}/messages`;
  }

  /**
   * `GET /v3/domains/{domain}`. A 404 means the account key works and the
   * domain (or the region) is wrong. A 401 is ambiguous: a wrong key, or a
   * domain sending key, which can send but cannot read the domain; so it is
   * "could not check", not a refusal.
   */
  verify(): Promise<KeyCheck> {
    return checkKeyOverHttp(
      "Mailgun",
      `https://${this.host}/v3/domains/${encodeURIComponent(this.config.domain)}`,
      { Authorization: "Basic " + Buffer.from(`api:${this.config.apiKey}`).toString("base64") },
      (status) => {
        if (status >= 200 && status < 300) return KEY_VALID;
        if (status === 404) {
          return keyInvalid(`Mailgun has no domain "${this.config.domain}" in this account. Check the domain and the region.`);
        }
        if (status === 401 || status === 403) {
          return keyUnknown(
            "Mailgun refused to show the domain with this key. A domain sending key can't be checked this way; if it is an account API key, it is wrong.",
          );
        }
        return null;
      },
    );
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      // Mailgun uses form-data for the API
      const formData = new URLSearchParams();
      formData.append("from", options.from);
      formData.append("to", options.to);
      formData.append("subject", options.subject);
      formData.append("html", options.html);

      if (options.text) {
        formData.append("text", options.text);
      }

      if (options.replyTo) {
        formData.append("h:Reply-To", options.replyTo);
      }

      // Mailgun carries custom headers as h:-prefixed form fields.
      for (const [name, value] of Object.entries(options.headers ?? {})) {
        formData.append(`h:${name}`, value);
      }

      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`api:${this.config.apiKey}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!res.ok) {
        let errorMessage = `Mailgun API error (status ${res.status})`;
        try {
          const errData = await res.json();
          if (errData.message) {
            errorMessage = errData.message;
          }
        } catch {
          // ignore parse error
        }
        return {
          success: false,
          error: errorMessage,
          permanent: isPermanentHttpStatus(res.status),
        };
      }

      const data = await res.json();
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











