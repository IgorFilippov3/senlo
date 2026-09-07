import { IMailer, SendMailOptions, SendMailResult } from "../../ports";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export interface SesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class SesMailer implements IMailer {
  private client: SESClient;

  constructor(config: SesConfig) {
    this.client = new SESClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const command = new SendEmailCommand({
        Source: options.from,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
          },
          Body: {
            Html: {
              Data: options.html,
            },
            Text: options.text ? { Data: options.text } : undefined,
          },
        },
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      });

      // SendEmail has no field for custom headers, so List-Unsubscribe cannot
      // be attached here. Carrying it would mean switching this adapter to
      // SendRawEmail and building the MIME message ourselves.

      const response = await this.client.send(command);

      return {
        success: true,
        messageId: response.MessageId,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Unknown error sending via SES",
      };
    }
  }
}
