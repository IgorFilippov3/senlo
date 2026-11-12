import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createSign, generateKeyPairSync } from "node:crypto";
import {
  createSnsVerifier,
  fetchSnsUrl,
  isSnsCertUrl,
  isSnsUrl,
  parseSnsEnvelope,
  snsStringToSign,
  snsUrlRegion,
  topicRegion,
  type SnsEnvelope,
} from "../services/webhook/sns";

// A throwaway key and self-signed certificate made with openssl for these
// tests only. SNS certificates are trusted by the host they come from, not
// by their chain, so a self-signed one exercises the same code.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/sns/${name}`, import.meta.url), "utf8");
const KEY = fixture("test-only-signing-key.pem");
const CERT = fixture("test-only-signing-cert.pem");

const CERT_URL = "https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-abc123.pem";
const TOPIC = "arn:aws:sns:eu-west-1:123456789012:senlo-events";

function signEnvelope(env: Omit<SnsEnvelope, "Signature">, key = KEY): SnsEnvelope {
  const unsigned = { ...env, Signature: "" } as SnsEnvelope;
  const algorithm = env.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
  const Signature = createSign(algorithm).update(snsStringToSign(unsigned), "utf8").sign(key, "base64");
  return { ...unsigned, Signature };
}

function notification(overrides: Partial<SnsEnvelope> = {}): SnsEnvelope {
  return signEnvelope({
    Type: "Notification",
    MessageId: "22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324",
    TopicArn: TOPIC,
    Message: JSON.stringify({ eventType: "Delivery", mail: { messageId: "m-1" } }),
    Timestamp: "2026-11-12T10:00:00.000Z",
    SignatureVersion: "2",
    SigningCertURL: CERT_URL,
    ...overrides,
  });
}

function confirmation(overrides: Partial<SnsEnvelope> = {}): SnsEnvelope {
  return signEnvelope({
    Type: "SubscriptionConfirmation",
    MessageId: "165545c9-2a5c-472c-8df2-7ff2be2b3b1b",
    TopicArn: TOPIC,
    Message: "You have chosen to subscribe to the topic ...",
    Timestamp: "2026-11-12T10:00:00.000Z",
    SignatureVersion: "2",
    SigningCertURL: CERT_URL,
    SubscribeURL: `https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=${TOPIC}&Token=t0k`,
    Token: "t0k",
    ...overrides,
  });
}

function verifierWithCert(pem = CERT) {
  const fetch = vi.fn(async (_url: string) => pem);
  return { fetch, verifier: createSnsVerifier({ fetch }) };
}

describe("isSnsUrl / isSnsCertUrl", () => {
  it.each([
    "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-x.pem",
    "https://sns.cn-north-1.amazonaws.com.cn/SimpleNotificationService-x.pem",
    "https://sns.us-gov-west-1.amazonaws.com/SimpleNotificationService-x.pem",
  ])("accepts %s", (url) => {
    expect(isSnsCertUrl(url)).toBe(true);
  });

  it.each([
    ["S3 bucket under amazonaws.com", "https://evil.s3.amazonaws.com/cert.pem"],
    ["S3 path-style", "https://s3.amazonaws.com/sns.us-east-1.amazonaws.com/cert.pem"],
    ["suffix trick", "https://sns.us-east-1.amazonaws.com.evil.com/cert.pem"],
    ["prefix trick", "https://evilsns.us-east-1.amazonaws.com/cert.pem"],
    ["plain http", "http://sns.us-east-1.amazonaws.com/cert.pem"],
    ["credentials", "https://user:pw@sns.us-east-1.amazonaws.com/cert.pem"],
    ["explicit port", "https://sns.us-east-1.amazonaws.com:8443/cert.pem"],
    ["underscore in region", "https://sns.us_east_1.amazonaws.com/cert.pem"],
    ["not a URL", "sns.us-east-1.amazonaws.com/cert.pem"],
  ])("refuses %s", (_label, url) => {
    expect(isSnsCertUrl(url)).toBe(false);
  });

  it("requires a .pem path for certificates but not for other SNS URLs", () => {
    const url = "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription";
    expect(isSnsUrl(url)).toBe(true);
    expect(isSnsCertUrl(url)).toBe(false);
  });
});

describe("topicRegion / snsUrlRegion", () => {
  it("reads the region of a topic ARN and of an SNS host", () => {
    expect(topicRegion(TOPIC)).toBe("eu-west-1");
    expect(topicRegion("arn:aws:s3:::bucket")).toBeNull();
    expect(topicRegion("nope")).toBeNull();
    expect(snsUrlRegion(CERT_URL)).toBe("eu-west-1");
    expect(snsUrlRegion("https://example.com/")).toBeNull();
  });
});

describe("parseSnsEnvelope", () => {
  it("parses a notification and a subscription confirmation", () => {
    expect(parseSnsEnvelope(notification())?.Type).toBe("Notification");
    const env = parseSnsEnvelope(confirmation());
    expect(env?.Type).toBe("SubscriptionConfirmation");
    expect(env?.Token).toBe("t0k");
  });

  it("refuses unknown types, missing fields and unknown signature versions", () => {
    expect(parseSnsEnvelope({ ...notification(), Type: "Other" })).toBeNull();
    expect(parseSnsEnvelope({ ...notification(), TopicArn: undefined })).toBeNull();
    expect(parseSnsEnvelope({ ...notification(), SignatureVersion: "3" })).toBeNull();
    expect(parseSnsEnvelope({ ...confirmation(), SubscribeURL: undefined })).toBeNull();
    expect(parseSnsEnvelope([notification()])).toBeNull();
    expect(parseSnsEnvelope("x")).toBeNull();
  });
});

describe("snsStringToSign", () => {
  it("includes Subject only when present", () => {
    expect(snsStringToSign(notification())).not.toContain("Subject\n");
    expect(snsStringToSign(notification({ Subject: "Hi" }))).toContain("Subject\nHi\n");
  });

  it("orders confirmation fields as SNS does", () => {
    const names = snsStringToSign(confirmation())
      .split("\n")
      .filter((_, i) => i % 2 === 0)
      .filter(Boolean);
    expect(names).toEqual(["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"]);
  });
});

describe("createSnsVerifier", () => {
  it("accepts signature versions 1 and 2", async () => {
    const { verifier } = verifierWithCert();
    expect(await verifier.verify(notification({ SignatureVersion: "2" }))).toBe(true);
    expect(await verifier.verify(notification({ SignatureVersion: "1" }))).toBe(true);
    expect(await verifier.verify(confirmation())).toBe(true);
  });

  it("refuses a tampered message, topic or subscribe URL", async () => {
    const { verifier } = verifierWithCert();
    expect(await verifier.verify({ ...notification(), Message: "{}" })).toBe(false);
    expect(await verifier.verify({ ...notification(), TopicArn: "arn:aws:sns:eu-west-1:999999999999:x" })).toBe(false);
    expect(
      await verifier.verify({ ...confirmation(), SubscribeURL: "https://sns.eu-west-1.amazonaws.com/?evil" }),
    ).toBe(false);
  });

  it("refuses a signature made with another key", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const { Signature: _ignored, ...fields } = notification();
    const forged = signEnvelope(fields, pem);
    const { verifier } = verifierWithCert();
    expect(await verifier.verify(forged)).toBe(false);
  });

  it("never fetches a certificate from a host that is not SNS", async () => {
    const { verifier, fetch } = verifierWithCert();
    // Validly signed by the attacker's own key, served from their S3 bucket.
    const env = notification({ SigningCertURL: "https://attacker.s3.amazonaws.com/cert.pem" });
    expect(await verifier.verify(env)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses when the certificate cannot be fetched or is not a certificate", async () => {
    const failing = createSnsVerifier({ fetch: async () => { throw new Error("timeout"); } });
    expect(await failing.verify(notification())).toBe(false);
    const { verifier } = verifierWithCert("<html>not a cert</html>");
    expect(await verifier.verify(notification())).toBe(false);
  });

  it("caches a fetched certificate by URL, but not a failed fetch", async () => {
    const { verifier, fetch } = verifierWithCert();
    await verifier.verify(notification());
    await verifier.verify(confirmation());
    expect(fetch).toHaveBeenCalledTimes(1);

    let calls = 0;
    const flaky = createSnsVerifier({
      fetch: async () => {
        calls++;
        if (calls === 1) throw new Error("blip");
        return CERT;
      },
    });
    expect(await flaky.verify(notification())).toBe(false);
    expect(await flaky.verify(notification())).toBe(true);
    expect(calls).toBe(2);
  });
});

describe("fetchSnsUrl", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refuses a non-SNS URL without connecting", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchSnsUrl("https://attacker.s3.amazonaws.com/cert.pem")).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not follow redirects and caps the size", async () => {
    const fetchSpy = vi.fn(async () => new Response("x".repeat(20 * 1024)));
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchSnsUrl(CERT_URL)).rejects.toThrow(/too large/);
    expect(fetchSpy).toHaveBeenCalledWith(CERT_URL, expect.objectContaining({ redirect: "error" }));
  });

  it("returns the body of a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(CERT)));
    expect(await fetchSnsUrl(CERT_URL)).toBe(CERT);
  });

  it("throws on a non-2xx answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    await expect(fetchSnsUrl(CERT_URL)).rejects.toThrow(/403/);
  });
});
