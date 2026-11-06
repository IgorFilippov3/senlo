import { EmailProvider } from "../../domain";
import { SealedConfigError } from "../../secrets";
import { IMailer } from "../../ports";
import { ResendMailer } from "./resendMailer";
import { MailgunMailer } from "./mailgunMailer";
import { SesMailer } from "./sesMailer";
import { PostmarkMailer } from "./postmarkMailer";
import { SendGridMailer } from "./sendgridMailer";
import { MailjetMailer } from "./mailjetMailer";
import { CloudflareMailer } from "./cloudflareMailer";
import { SmtpMailer } from "./smtpMailer";
import { allowAllOutbound, type OutboundPolicy } from "../../outbound";

export class MailerFactory {
  /** `outbound` reaches the one adapter that connects where the user says (SMTP). */
  static create(provider: EmailProvider, outbound: OutboundPolicy = allowAllOutbound): IMailer {
    if (provider.configUnreadable) {
      throw new SealedConfigError(`Email provider ${provider.id}`);
    }
    switch (provider.type) {
      case "RESEND": {
        const apiKey = provider.config?.apiKey;
        if (!apiKey) {
          throw new Error("Resend API key is missing in provider config");
        }
        return new ResendMailer(apiKey);
      }

      case "MAILGUN": {
        const { apiKey, domain, region } = provider.config || {};
        if (!apiKey || !domain) {
          throw new Error(
            "Mailgun API key and domain are required in provider config",
          );
        }
        return new MailgunMailer({ apiKey, domain, region });
      }

      case "SES": {
        const { region, accessKeyId, secretAccessKey } = provider.config || {};
        if (!region || !accessKeyId || !secretAccessKey) {
          throw new Error(
            "SES region, accessKeyId, and secretAccessKey are required in provider config",
          );
        }
        return new SesMailer({ region, accessKeyId, secretAccessKey });
      }

      case "POSTMARK": {
        const serverToken = provider.config?.serverToken;
        if (!serverToken) {
          throw new Error(
            "Postmark server token is missing in provider config",
          );
        }
        return new PostmarkMailer(serverToken);
      }

      case "SENDGRID": {
        const { apiKey, region } = provider.config || {};
        if (!apiKey) {
          throw new Error("SendGrid API key is missing in provider config");
        }
        return new SendGridMailer({ apiKey, region: region === "EU" ? "EU" : "US" });
      }

      case "MAILJET": {
        const { apiKey, apiSecret, region } = provider.config || {};
        if (!apiKey || !apiSecret) {
          throw new Error("Mailjet API key and secret key are required in provider config");
        }
        return new MailjetMailer({ apiKey, apiSecret, region: region === "US" ? "US" : "GLOBAL" });
      }

      case "CLOUDFLARE": {
        const { accountId, apiKey } = provider.config || {};
        if (!accountId || !apiKey) {
          throw new Error("Cloudflare account ID and API token are required in provider config");
        }
        return new CloudflareMailer({ accountId, apiToken: apiKey });
      }

      case "SMTP": {
        const { host, port, encryption, username, password } =
          provider.config || {};
        if (!host || !port) {
          throw new Error("SMTP host and port are required in provider config");
        }
        return new SmtpMailer(
          {
            host,
            port: Number(port),
            encryption,
            username,
            password,
          },
          outbound,
        );
      }

      default:
        throw new Error(
          `Unsupported email provider type: ${(provider as any).type}`,
        );
    }
  }
}

export { ResendMailer } from "./resendMailer";
export { MailgunMailer } from "./mailgunMailer";
export { SesMailer } from "./sesMailer";
export { PostmarkMailer } from "./postmarkMailer";
export { SendGridMailer, parseSendGridAddress } from "./sendgridMailer";
export { MailjetMailer, parseMailjetAddress } from "./mailjetMailer";
export { CloudflareMailer, parseCloudflareAddress, CLOUDFLARE_ACCOUNT_ID } from "./cloudflareMailer";
export { SmtpMailer } from "./smtpMailer";
export type { MailgunConfig } from "./mailgunMailer";
export type { SesConfig } from "./sesMailer";
export type { SendGridConfig } from "./sendgridMailer";
export type { MailjetConfig } from "./mailjetMailer";
export type { CloudflareConfig } from "./cloudflareMailer";
export type { SmtpConfig, SmtpEncryption } from "./smtpMailer";
