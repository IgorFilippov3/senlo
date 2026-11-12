import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { GetSendQuotaCommand, SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { KEY_VALID, keyInvalid, keyLimited, keyUnknown } from "./keyCheck";

/** AWS saying the access key or its signature is wrong. */
const BAD_CREDENTIALS = new Set(["InvalidClientTokenId", "SignatureDoesNotMatch", "UnrecognizedClientException", "IncompleteSignature"]);
/** The key works but this action is not allowed for it (an IAM policy with only `ses:SendEmail`). */
const NOT_ALLOWED = new Set(["AccessDenied", "AccessDeniedException"]);
/** SES refusals a retry cannot change. */
const PERMANENT = new Set([
  ...BAD_CREDENTIALS,
  ...NOT_ALLOWED,
  "MessageRejected",
  "MailFromDomainNotVerifiedException",
  "ConfigurationSetDoesNotExistException",
  "AccountSendingPausedException",
]);

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

  /** `GetSendQuota`: cheap, and refused with a clear name for a bad key. */
  async verify(): Promise<KeyCheck> {
    try {
      await this.client.send(new GetSendQuotaCommand({}), { abortSignal: AbortSignal.timeout(10_000) });
      return KEY_VALID;
    } catch (e: any) {
      const name: string = e?.name ?? "";
      if (BAD_CREDENTIALS.has(name)) return keyInvalid(`AWS rejected the access key: ${e.message || name}`);
      if (NOT_ALLOWED.has(name)) {
        return keyLimited("The key may not read the sending quota (an IAM policy for sending only); sending is not affected");
      }
      return keyUnknown(`Could not check the key with SES: ${e?.message || name || "unknown error"}`);
    }
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
        permanent: PERMANENT.has(e?.name),
      };
    }
  }
}
