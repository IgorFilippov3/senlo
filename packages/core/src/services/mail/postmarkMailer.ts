import { IMailer, SendMailOptions, SendMailResult } from "../../ports";

export class PostmarkMailer implements IMailer {
  constructor(private readonly serverToken: string) {}

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Postmark-Server-Token": this.serverToken,
        },
        body: JSON.stringify({
          From: options.from,
          To: options.to,
          Subject: options.subject,
          HtmlBody: options.html,
          TextBody: options.text,
          ReplyTo: options.replyTo,
          Headers: options.headers
            ? Object.entries(options.headers).map(([Name, Value]) => ({
                Name,
                Value,
              }))
            : undefined,
          Metadata: options.tags,
          TrackOpens: true,
          TrackLinks: "HtmlAndText",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data.Message || `Postmark API error (status ${res.status})`,
        };
      }

      return {
        success: true,
        messageId: data.MessageID,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Unknown error",
      };
    }
  }
}
