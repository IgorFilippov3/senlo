// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GetAccountCommand, SESv2Client, SendEmailCommand, type MessageHeader, type MessageTag } from "@aws-sdk/client-sesv2";
import type { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { KEY_CHECK_TIMEOUT_MS, KEY_VALID, keyInvalid, keyLimited, keyUnknown } from "./keyCheck";

/** AWS saying the access key or its signature is wrong. */
const BAD_CREDENTIALS = new Set([
  "InvalidClientTokenId",
  "UnrecognizedClientException",
  "SignatureDoesNotMatch",
  "InvalidSignatureException",
  "IncompleteSignature",
]);
/** The key works but this action is not allowed for it (an IAM policy with only `ses:SendEmail`). */
const NOT_ALLOWED = new Set(["AccessDenied", "AccessDeniedException"]);
/**
 * SES v2 refusals a retry cannot change. Not here: `TooManyRequestsException`,
 * `LimitExceededException` (rate or daily quota, they pass) and
 * `InternalServiceErrorException`.
 */
const PERMANENT = new Set([
  ...BAD_CREDENTIALS,
  ...NOT_ALLOWED,
  "MessageRejected",
  "MailFromDomainNotVerifiedException",
  "AccountSuspendedException",
  "SendingPausedException",
  /** A configuration set that does not exist. */
  "NotFoundException",
  "BadRequestException",
]);

/**
 * Headers SES sets itself and refuses as custom headers on `SendEmail` with
 * simple content. Lower-case.
 */
const RESERVED_HEADERS = new Set([
  "bcc",
  "cc",
  "content-disposition",
  "content-type",
  "date",
  "from",
  "message-id",
  "mime-version",
  "reply-to",
  "return-path",
  "subject",
  "to",
]);

/** Message tag names and values: ASCII letters, digits, `_` and `-`, at most 256 characters. */
const TAG_CHARS = /[^A-Za-z0-9_-]/g;
const TAG_MAX = 256;

export interface SesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Configuration set every email is sent with. Its event destination (an
   * SNS topic) is what delivers bounces and complaints back to Senlo;
   * without it SES sends but reports nothing.
   */
  configurationSet?: string;
}

/** Custom headers SES accepts, in the order given. */
export function sesHeaders(headers: Record<string, string> | undefined): MessageHeader[] | undefined {
  const out = Object.entries(headers ?? {})
    .filter(([name, value]) => name && value && !RESERVED_HEADERS.has(name.toLowerCase()))
    .map(([Name, Value]) => ({ Name, Value }));
  return out.length ? out : undefined;
}

/** Senlo's tags as SES message tags, cleaned to what SES allows. */
export function sesTags(tags: Record<string, string> | undefined): MessageTag[] | undefined {
  const out: MessageTag[] = [];
  for (const [name, value] of Object.entries(tags ?? {})) {
    const Name = name.replace(TAG_CHARS, "_").slice(0, TAG_MAX);
    const Value = String(value).replace(TAG_CHARS, "_").slice(0, TAG_MAX);
    if (Name && Value) out.push({ Name, Value });
  }
  return out.length ? out : undefined;
}

/** Amazon SES through the v2 API (custom headers need v2). */
export class SesMailer implements IMailer {
  private readonly client: SESv2Client;
  private readonly configurationSet?: string;

  constructor(config: SesConfig, client?: SESv2Client) {
    this.configurationSet = config.configurationSet?.trim() || undefined;
    this.client =
      client ??
      new SESv2Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
  }

  /**
   * `GetAccount`: cheap, refused with a clear name for a bad key, and says
   * whether the account can send to anyone yet.
   */
  async verify(): Promise<KeyCheck> {
    try {
      const account = await this.client.send(new GetAccountCommand({}), {
        abortSignal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS),
      });
      if (account.SendingEnabled === false) {
        return keyLimited("Sending is paused for this SES account (Account dashboard in the SES console)");
      }
      if (account.ProductionAccessEnabled === false) {
        return keyLimited(
          "This SES account is in the sandbox: it can only send to verified addresses until AWS grants production access",
        );
      }
      return KEY_VALID;
    } catch (e: any) {
      const name: string = e?.name ?? "";
      if (BAD_CREDENTIALS.has(name)) return keyInvalid(`AWS rejected the access key: ${e.message || name}`);
      if (NOT_ALLOWED.has(name)) {
        return keyLimited("The key may not read the account (an IAM policy for sending only); sending is not affected");
      }
      return keyUnknown(`Could not check the key with SES: ${e?.message || name || "unknown error"}`);
    }
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const response = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: options.from,
          Destination: { ToAddresses: [options.to] },
          ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
          ConfigurationSetName: this.configurationSet,
          EmailTags: sesTags(options.tags),
          Content: {
            Simple: {
              Subject: { Data: options.subject, Charset: "UTF-8" },
              Body: {
                Html: { Data: options.html, Charset: "UTF-8" },
                Text: options.text ? { Data: options.text, Charset: "UTF-8" } : undefined,
              },
              Headers: sesHeaders(options.headers),
            },
          },
        }),
      );
      return { success: true, messageId: response.MessageId };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Unknown error sending via SES",
        permanent: PERMANENT.has(e?.name),
      };
    }
  }
}
