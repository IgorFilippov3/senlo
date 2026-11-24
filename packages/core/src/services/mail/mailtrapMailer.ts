// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IMailer, KeyCheck, SendMailOptions, SendMailResult } from "../../ports";
import { checkKeyOverHttp, isPermanentHttpStatus, KEY_VALID, keyInvalid, keyLimited, keyUnknown } from "./keyCheck";

/** The transactional stream. The bulk stream, batch sending and the sandbox are not used. */
export const MAILTRAP_SEND_URL = "https://send.api.mailtrap.io/api/send";

/** The resources (domains, projects, sandboxes) a token can reach; needs no account id. */
export const MAILTRAP_PERMISSIONS_URL = "https://mailtrap.io/api/permissions/resources";

interface MailtrapAddress {
  email: string;
  name?: string;
}

/** `Name <a@b.c>` or a bare address, as Mailtrap's `{ email, name }`. */
export function parseMailtrapAddress(value: string): MailtrapAddress {
  const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(value);
  if (!match) return { email: value.trim() };
  const name = match[1].replace(/^"(.*)"$/, "$1").trim();
  return name ? { email: match[2].trim(), name } : { email: match[2].trim() };
}

interface MailtrapResource {
  type?: string;
  resources?: MailtrapResource[];
}

/**
 * Whether the permissions tree holds a sending domain. This endpoint calls it
 * `domain`; the account-scoped one says `sending_domain`, so accept both.
 */
function hasSendingDomain(nodes: MailtrapResource[]): boolean {
  return nodes.some(
    (node) =>
      node?.type === "domain" ||
      node?.type === "sending_domain" ||
      (Array.isArray(node?.resources) && hasSendingDomain(node.resources)),
  );
}

/** The send API answers `{ success: false, errors: ["..."] }`; join them. */
function readError(data: any, status: number): string {
  const errors = data?.errors;
  if (Array.isArray(errors)) {
    const messages = errors.filter((e: unknown) => typeof e === "string" && e);
    if (messages.length) return messages.join("; ");
  }
  // Mailtrap's account APIs use a single string; accept it too.
  if (typeof errors === "string" && errors) return errors;
  if (typeof data?.error === "string" && data.error) return data.error;
  return `Mailtrap API error (status ${status})`;
}

/**
 * Mailtrap Email Sending, transactional stream (`POST /api/send`).
 *
 * Tags go out as `custom_variables`; Mailtrap hands them back on every
 * webhook event, which is how a delivery webhook will find its project.
 * Mailtrap caps the custom variables payload at 1000 bytes (documented for
 * the SMTP `X-MT-Custom-Variables` header and assumed for the API): Senlo's
 * tags are a few short ids, well under it, but keep it in mind before
 * adding more.
 *
 * Open and click tracking cannot be switched off per message: it is a
 * setting of the sending domain (Domains → the domain → Tracking Settings).
 * Senlo adds its own pixel and tracked links, so the docs tell users to turn
 * Mailtrap's off, or links are rewritten twice and opens counted twice.
 *
 * `verify()` reads `GET /api/permissions/resources`: an account token and a
 * token scoped to one sending domain both get 200, with the domains they can
 * reach. A bad token gets 401; 403 is "no permission", not a bad token.
 */
export class MailtrapMailer implements IMailer {
  constructor(
    private readonly apiToken: string,
    private readonly url: string = MAILTRAP_SEND_URL,
  ) {}

  verify(): Promise<KeyCheck> {
    return checkKeyOverHttp(
      "Mailtrap",
      MAILTRAP_PERMISSIONS_URL,
      { Authorization: `Bearer ${this.apiToken}` },
      (status, body) => {
        if (status === 401) {
          return keyInvalid(`Mailtrap rejected the API token${body?.error ? `: ${body.error}` : ""}`);
        }
        if (status === 403) {
          return keyLimited("Senlo cannot read this token's permissions; sending is not affected");
        }
        if (status >= 200 && status < 300 && Array.isArray(body)) {
          // The list holds resources the token has admin access to, so a
          // token without a domain in it may still send: warn, don't refuse.
          return hasSendingDomain(body)
            ? KEY_VALID
            : keyUnknown(
                "This Mailtrap token has no sending domain in its permissions. If sends fail, give it access to your verified domain.",
              );
        }
        return null;
      },
    );
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // Mailtrap's edge may block requests without a User-Agent.
          "User-Agent": "Senlo",
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          from: parseMailtrapAddress(options.from),
          to: [parseMailtrapAddress(options.to)],
          reply_to: options.replyTo ? parseMailtrapAddress(options.replyTo) : undefined,
          subject: options.subject,
          html: options.html,
          // Mailtrap refuses an empty text part (minLength 1).
          text: options.text || undefined,
          headers: options.headers,
          custom_variables: options.tags,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        return {
          success: false,
          error: readError(data, res.status),
          permanent: isPermanentHttpStatus(res.status),
        };
      }

      const messageId = data?.message_ids?.[0];
      return {
        success: true,
        messageId: typeof messageId === "string" ? messageId : undefined,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Unknown error",
      };
    }
  }
}
