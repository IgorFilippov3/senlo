import { IMailer, SendMailOptions, SendMailResult } from "../../ports";

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  region?: "US" | "EU";
}

export class MailgunMailer implements IMailer {
  private readonly baseUrl: string;

  constructor(private readonly config: MailgunConfig) {
    // EU region uses api.eu.mailgun.net, US uses api.mailgun.net
    const host =
      config.region?.toUpperCase() === "EU" ? "api.eu.mailgun.net" : "api.mailgun.net";
    this.baseUrl = `https://${host}/v3/${config.domain}/messages`;
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











