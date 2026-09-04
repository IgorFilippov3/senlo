import { EmailProvider } from "../../domain";
import { IMailer } from "../../ports";
import { ResendMailer } from "./resendMailer";
import { MailgunMailer } from "./mailgunMailer";
import { SesMailer } from "./sesMailer";
import { PostmarkMailer } from "./postmarkMailer";
import { SmtpMailer } from "./smtpMailer";

export class MailerFactory {
  static create(provider: EmailProvider): IMailer {
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

      case "SMTP": {
        const { host, port, encryption, username, password } =
          provider.config || {};
        if (!host || !port) {
          throw new Error("SMTP host and port are required in provider config");
        }
        return new SmtpMailer({
          host,
          port: Number(port),
          encryption,
          username,
          password,
        });
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
export { SmtpMailer } from "./smtpMailer";
export type { MailgunConfig } from "./mailgunMailer";
export type { SesConfig } from "./sesMailer";
export type { SmtpConfig, SmtpEncryption } from "./smtpMailer";
