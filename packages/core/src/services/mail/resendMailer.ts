import { IMailer, SendMailOptions, SendMailResult } from "../../ports";

export class ResendMailer implements IMailer {
  constructor(private readonly apiKey: string) {}

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: options.from,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
          headers: options.headers,
          tags: options.tags
            ? Object.entries(options.tags).map(([name, value]) => ({
                name,
                value,
              }))
            : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        return {
          success: false,
          error: errData.message || `Resend API error (status ${res.status})`,
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
