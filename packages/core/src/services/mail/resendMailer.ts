import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { authStatus, checkKeyOverHttp, isPermanentHttpStatus, keyLimited } from "./keyCheck";

export class ResendMailer implements IMailer {
  constructor(private readonly apiKey: string) {}

  /**
   * `GET /domains` needs a full-access key. A sending-only key gets 401
   * `restricted_api_key`: it works for sending, so it is `limited`, not
   * invalid. A wrong key gets 403 `invalid_api_key`.
   */
  verify(): Promise<KeyCheck> {
    return checkKeyOverHttp("Resend", "https://api.resend.com/domains", { Authorization: `Bearer ${this.apiKey}` }, (status, body) =>
      body?.name === "restricted_api_key"
        ? keyLimited("A sending-only key: Senlo cannot read your domains with it, sending is not affected")
        : authStatus("Resend", status, body?.message),
    );
  }

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
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.message || `Resend API error (status ${res.status})`,
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
