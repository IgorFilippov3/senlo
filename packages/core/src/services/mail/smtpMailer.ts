import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { IMailer, SendMailOptions, SendMailResult } from "../../ports";
import { allowAllOutbound, assertOutbound, type OutboundPolicy } from "../../outbound";

export type SmtpEncryption = "ssl" | "starttls" | "none";

export interface SmtpConfig {
  host: string;
  port: number;
  /**
   * How the connection is protected. Kept as an explicit choice rather than
   * inferred from the port: most servers follow the 465/587 convention, and
   * the ones that do not are exactly the ones an operator needs to configure
   * by hand.
   */
  encryption?: SmtpEncryption;
  username?: string;
  password?: string;
}

/**
 * Pooled transporters, keyed by the configuration that produced them.
 *
 * Campaigns are sent in chunks through BullMQ, and a mailer is built per
 * message. The other four adapters are stateless HTTP calls, so none of them
 * had to think about this; SMTP would otherwise open a TCP connection and run
 * the TLS and AUTH handshake for every single recipient, which is the
 * difference between a campaign that takes a minute and one that takes an
 * hour. A pooled transporter keeps a small number of connections open and
 * reuses them.
 */
const transporters = new Map<string, Transporter>();

function transporterFor(config: SmtpConfig): Transporter {
  const key = JSON.stringify([
    config.host,
    config.port,
    config.encryption ?? "starttls",
    config.username ?? "",
    config.password ?? "",
  ]);

  const existing = transporters.get(key);
  if (existing) {
    return existing;
  }

  const encryption = config.encryption ?? "starttls";

  const transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    host: config.host,
    port: config.port,
    // Implicit TLS from the first byte — the classic port 465 setup.
    secure: encryption === "ssl",
    // Refuse to fall back to plaintext when STARTTLS was asked for. Without
    // this a server that quietly drops the upgrade would carry credentials in
    // the clear.
    requireTLS: encryption === "starttls",
    ignoreTLS: encryption === "none",
    // Authentication is optional: an internal relay on a private network
    // commonly accepts mail from known hosts without it.
    auth: config.username
      ? { user: config.username, pass: config.password ?? "" }
      : undefined,
  });

  transporters.set(key, transporter);
  return transporter;
}

export class SmtpMailer implements IMailer {
  constructor(
    private readonly config: SmtpConfig,
    /** Where the user's SMTP host may be; a shared instance refuses internal addresses. */
    private readonly outbound: OutboundPolicy = allowAllOutbound,
  ) {}

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      // Before the pooled transporter: a refused host never opens a connection.
      await assertOutbound(this.outbound, { host: this.config.host, port: this.config.port });
      const info = await transporterFor(this.config).sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        // SMTP has no notion of tags. Carrying them as headers costs nothing
        // and makes a message traceable in the receiving server's logs.
        headers: {
          ...Object.fromEntries(
            Object.entries(options.tags ?? {}).map(([name, value]) => [
              `X-Senlo-${name}`,
              value,
            ]),
          ),
          ...(options.headers ?? {}),
        },
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Unknown error sending over SMTP",
      };
    }
  }
}
