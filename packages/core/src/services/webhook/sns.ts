// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createVerify } from "node:crypto";
import { isRecord } from "./types";

/**
 * Amazon SNS HTTP(S) delivery: the JSON envelope SNS posts, and the check
 * that it was signed by SNS.
 *
 * What the check proves: the envelope was signed with the key of a
 * certificate served from an SNS host. Not which topic or account sent it:
 * any AWS account can create a topic and subscribe an endpoint to it, so the
 * caller must still compare `TopicArn` with the topic it expects.
 *
 * The certificate is trusted because of where it is served from, not
 * because of a chain: SNS certificates are not validated against a CA here.
 * That is why the host check is strict. A suffix check like
 * `*.amazonaws.com` is a known hole: S3 buckets live under that suffix, so
 * anyone could host their own certificate there and sign anything.
 */

export type SnsMessageType = "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";

export interface SnsEnvelope {
  Type: SnsMessageType;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: "1" | "2";
  Signature: string;
  SigningCertURL: string;
  /** Notification only, and optional there. */
  Subject?: string;
  /** (Un)SubscriptionConfirmation only. */
  SubscribeURL?: string;
  /** (Un)SubscriptionConfirmation only. */
  Token?: string;
}

const MESSAGE_TYPES = new Set<string>(["Notification", "SubscriptionConfirmation", "UnsubscribeConfirmation"]);

/** `sns.<region>.amazonaws.com`, and the China partition's `.com.cn`. */
const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

/** A certificate is ~2 KB; anything far larger is not one. */
export const SNS_MAX_RESPONSE_BYTES = 16 * 1024;
export const SNS_FETCH_TIMEOUT_MS = 5_000;
const CERT_CACHE_SIZE = 50;

/**
 * True for an `https://sns.<region>.amazonaws.com[.cn]/...` URL with no
 * credentials and no explicit port. Used for the signing certificate and
 * for the SubscribeURL.
 */
export function isSnsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    SNS_HOST.test(url.hostname)
  );
}

/** A signing certificate URL: an SNS URL whose path is a `.pem` file. */
export function isSnsCertUrl(value: string): boolean {
  return isSnsUrl(value) && new URL(value).pathname.endsWith(".pem");
}

/** Region of an SNS topic ARN (`arn:aws:sns:<region>:<account>:<name>`), or null. */
export function topicRegion(topicArn: string): string | null {
  const parts = topicArn.split(":");
  return parts.length === 6 && parts[0] === "arn" && parts[2] === "sns" && parts[3] ? parts[3] : null;
}

/** Region in an SNS host name (`sns.<region>.amazonaws.com`), or null. */
export function snsUrlRegion(value: string): string | null {
  if (!isSnsUrl(value)) return null;
  return new URL(value).hostname.split(".")[1] ?? null;
}

const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** The envelope's fields with their types checked, or null when it is not an SNS envelope. */
export function parseSnsEnvelope(body: unknown): SnsEnvelope | null {
  if (!isRecord(body)) return null;
  const { Type, MessageId, TopicArn, Message, Timestamp, SignatureVersion, Signature, SigningCertURL } = body;
  if (!str(Type) || !MESSAGE_TYPES.has(Type)) return null;
  if (!str(MessageId) || !str(TopicArn) || typeof Message !== "string" || !str(Timestamp)) return null;
  if (SignatureVersion !== "1" && SignatureVersion !== "2") return null;
  if (!str(Signature) || !str(SigningCertURL)) return null;

  const envelope: SnsEnvelope = {
    Type: Type as SnsMessageType,
    MessageId,
    TopicArn,
    Message,
    Timestamp,
    SignatureVersion,
    Signature,
    SigningCertURL,
  };
  if (Type === "Notification") {
    if (body.Subject !== undefined && body.Subject !== null) {
      if (typeof body.Subject !== "string") return null;
      envelope.Subject = body.Subject;
    }
  } else {
    if (!str(body.SubscribeURL) || !str(body.Token)) return null;
    envelope.SubscribeURL = body.SubscribeURL;
    envelope.Token = body.Token;
  }
  return envelope;
}

/**
 * The string SNS signs: selected fields as `Name\nValue\n`, in this order.
 * https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message-verify-message-signature.html
 */
export function snsStringToSign(env: SnsEnvelope): string {
  const fields: Array<[string, string | undefined]> =
    env.Type === "Notification"
      ? [
          ["Message", env.Message],
          ["MessageId", env.MessageId],
          ["Subject", env.Subject],
          ["Timestamp", env.Timestamp],
          ["TopicArn", env.TopicArn],
          ["Type", env.Type],
        ]
      : [
          ["Message", env.Message],
          ["MessageId", env.MessageId],
          ["SubscribeURL", env.SubscribeURL],
          ["Timestamp", env.Timestamp],
          ["Token", env.Token],
          ["TopicArn", env.TopicArn],
          ["Type", env.Type],
        ];
  return fields
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}\n${value}\n`)
    .join("");
}

/** GETs an SNS URL and returns the body as text. Throws on any failure. */
export type SnsFetch = (url: string) => Promise<string>;

/**
 * GET with the SNS host pin re-checked, no redirects (a redirect to an S3
 * host would bypass the pin), a timeout and a size cap.
 */
export const fetchSnsUrl: SnsFetch = async (url) => {
  if (!isSnsUrl(url)) throw new Error("Not an SNS URL");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(SNS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`SNS answered ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > SNS_MAX_RESPONSE_BYTES) throw new Error("SNS response too large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > SNS_MAX_RESPONSE_BYTES) throw new Error("SNS response too large");
  return new TextDecoder().decode(bytes);
};

export interface SnsVerifier {
  /** True when the envelope's signature checks out against a certificate served by SNS. */
  verify(envelope: SnsEnvelope): Promise<boolean>;
}

/**
 * Checks SNS signatures. Certificates are cached in memory by URL (SNS
 * rotates them rarely); a failed fetch is not cached.
 */
export function createSnsVerifier(options: { fetch?: SnsFetch } = {}): SnsVerifier {
  const fetchText = options.fetch ?? fetchSnsUrl;
  const certs = new Map<string, Promise<string>>();

  const certificate = (url: string): Promise<string> => {
    const cached = certs.get(url);
    if (cached) return cached;
    const pending = fetchText(url).then((pem) => {
      if (!pem.includes("-----BEGIN CERTIFICATE-----")) throw new Error("Not a PEM certificate");
      return pem;
    });
    pending.catch(() => certs.delete(url));
    if (certs.size >= CERT_CACHE_SIZE) {
      const oldest = certs.keys().next().value;
      if (oldest !== undefined) certs.delete(oldest);
    }
    certs.set(url, pending);
    return pending;
  };

  return {
    async verify(envelope) {
      // Checked before anything is fetched: an envelope pointing elsewhere
      // never makes the server connect anywhere.
      if (!isSnsCertUrl(envelope.SigningCertURL)) return false;
      try {
        const pem = await certificate(envelope.SigningCertURL);
        const algorithm = envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
        return createVerify(algorithm)
          .update(snsStringToSign(envelope), "utf8")
          .verify(pem, envelope.Signature, "base64");
      } catch {
        return false;
      }
    },
  };
}
