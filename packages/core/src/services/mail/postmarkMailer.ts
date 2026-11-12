import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { authStatus, checkKeyOverHttp, isPermanentHttpStatus } from "./keyCheck";

export class PostmarkMailer implements IMailer {
  constructor(private readonly serverToken: string) {}

  /** `GET /server`: any server token may read its own server. */
  verify(): Promise<KeyCheck> {
    return checkKeyOverHttp(
      "Postmark",
      "https://api.postmarkapp.com/server",
      { "X-Postmark-Server-Token": this.serverToken },
      (status, body) => authStatus("Postmark", status, body?.Message),
    );
  }

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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          error: data.Message || `Postmark API error (status ${res.status})`,
          permanent: isPermanentHttpStatus(res.status),
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
