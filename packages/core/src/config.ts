// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Everything the packages need from the outside world, in one typed object.
 *
 * The packages never read the environment themselves: an app builds this
 * once - from env vars, a secret manager, per test - and passes it in. That
 * is what lets a separate app (the managed version) run the same code with
 * its own configuration.
 */
export interface SenloConfig {
  /** Public base URL; unsubscribe and tracking links in mail point here. */
  appUrl: string;
  databaseUrl: string;
  redisUrl: string;
  /** Prefix for queue and rate-limit keys, so instances can share a Redis. */
  queuePrefix: string;
  /** Signs and seals unsubscribe and tracking links. */
  linkSigningSecret: string;
  /** Seals provider credentials at rest. Must not change once providers exist. */
  secretsKey: string;
  /** Sender when a trigger or campaign does not set one. */
  defaultFromEmail: string;
  /** Where uploads go. Local disk unless `STORAGE_DRIVER=s3`. */
  storage: StorageConfig;
}

export interface S3StorageConfig {
  driver: "s3";
  bucket: string;
  region: string;
  /** Set for S3-compatible services (Cloudflare R2, MinIO); unset for AWS. */
  endpoint: string | null;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base of the public URL for stored objects, without a trailing slash. */
  publicUrl: string;
  /** Key prefix inside the bucket, e.g. `uploads`; empty for the bucket root. */
  keyPrefix: string;
  /** Path-style addressing (`endpoint/bucket/key`); most S3-compatible services need it. */
  forcePathStyle: boolean;
}

export type StorageConfig = { driver: "local" } | S3StorageConfig;

/** The part of the config outgoing mail needs. */
export type MailSettings = Pick<
  SenloConfig,
  "appUrl" | "linkSigningSecret" | "defaultFromEmail"
>;

export type Env = Record<string, string | undefined>;

/** Lists every problem at once, so a misconfigured install is fixed in one pass. */
export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Senlo is not configured correctly:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    this.name = "ConfigError";
  }
}

const SINGLE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function value(env: Env, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

/**
 * Builds the config from environment variables and checks it.
 *
 * Required: `DATABASE_URL`, `AUTH_SECRET` (or `LINK_SIGNING_SECRET`; `SECRETS_KEY`
 * is optional and falls back to it), and
 * `APP_URL` in production - outside production it falls back to
 * http://localhost:3000. `NEXT_PUBLIC_APP_URL` is still read as the old name
 * of `APP_URL`, so existing .env files keep working.
 *
 * Takes the env as an argument rather than reading `process.env`: core stays
 * free of ambient state, and inside Next.js a literal
 * `process.env.NEXT_PUBLIC_*` would be frozen into the build.
 */
export function loadSenloConfig(env: Env): SenloConfig {
  const problems: string[] = [];
  const production = env.NODE_ENV === "production";

  let appUrl = value(env, "APP_URL", "NEXT_PUBLIC_APP_URL");
  if (!appUrl) {
    if (production) {
      problems.push(
        "APP_URL is not set. Set it to the address Senlo is reached at, e.g. https://mail.example.com - links in outgoing mail point there.",
      );
    }
    appUrl = "http://localhost:3000";
  } else if (!/^https?:\/\/[^/\s]+/i.test(appUrl)) {
    problems.push(`APP_URL must be an http(s) address, got "${appUrl}".`);
  }
  appUrl = appUrl.replace(/\/+$/, "");

  const databaseUrl = value(env, "DATABASE_URL");
  if (!databaseUrl) problems.push("DATABASE_URL is not set.");

  // A separate LINK_SIGNING_SECRET lets AUTH_SECRET rotate (signing everyone
  // out) without breaking unsubscribe and tracking links in mail already sent.
  const linkSigningSecret = value(env, "LINK_SIGNING_SECRET", "AUTH_SECRET");
  if (!linkSigningSecret) {
    problems.push(
      "AUTH_SECRET is not set. Generate one with: openssl rand -base64 32",
    );
  }

  // SECRETS_KEY seals provider credentials in the database. Falling back to
  // the signing secret keeps an existing install working without a new
  // variable, at the price that rotating that secret then also needs
  // `db:reseal-secrets` with both keys. Setting SECRETS_KEY separates them.
  const secretsKey = value(env, "SECRETS_KEY") ?? linkSigningSecret;

  const defaultFromEmail = value(env, "DEFAULT_FROM_EMAIL") ?? "hello@senlo.io";
  if (!SINGLE_ADDRESS.test(defaultFromEmail)) {
    problems.push(
      `DEFAULT_FROM_EMAIL must be a single plain address, got "${defaultFromEmail}".`,
    );
  }

  const storage = loadStorageConfig(env, problems);

  if (problems.length > 0) throw new ConfigError(problems);

  return Object.freeze({
    appUrl,
    databaseUrl: databaseUrl!,
    redisUrl: value(env, "REDIS_URL") ?? "redis://localhost:6379",
    queuePrefix: value(env, "REDIS_QUEUE_PREFIX") ?? "senlo",
    linkSigningSecret: linkSigningSecret!,
    secretsKey: secretsKey!,
    defaultFromEmail,
    storage,
  });
}

/**
 * `STORAGE_DRIVER=s3` with `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`,
 * `S3_SECRET_ACCESS_KEY`; `S3_ENDPOINT` for a compatible service, which then
 * also needs `S3_PUBLIC_URL` (AWS can derive it). Anything else is local disk.
 */
function loadStorageConfig(env: Env, problems: string[]): StorageConfig {
  const driver = value(env, "STORAGE_DRIVER") ?? "local";
  if (driver === "local") return { driver: "local" };
  if (driver !== "s3") {
    problems.push(`STORAGE_DRIVER must be "local" or "s3", got "${driver}".`);
    return { driver: "local" };
  }

  const bucket = value(env, "S3_BUCKET");
  const region = value(env, "S3_REGION");
  const accessKeyId = value(env, "S3_ACCESS_KEY_ID");
  const secretAccessKey = value(env, "S3_SECRET_ACCESS_KEY");
  const endpoint = value(env, "S3_ENDPOINT")?.replace(/\/+$/, "") ?? null;
  for (const [name, v] of [
    ["S3_BUCKET", bucket],
    ["S3_REGION", region],
    ["S3_ACCESS_KEY_ID", accessKeyId],
    ["S3_SECRET_ACCESS_KEY", secretAccessKey],
  ] as const) {
    if (!v) problems.push(`${name} is not set (required with STORAGE_DRIVER=s3).`);
  }
  if (endpoint && !/^https?:\/\/[^/\s]+/i.test(endpoint)) {
    problems.push(`S3_ENDPOINT must be an http(s) address, got "${endpoint}".`);
  }

  let publicUrl = value(env, "S3_PUBLIC_URL")?.replace(/\/+$/, "");
  if (!publicUrl) {
    if (endpoint) {
      problems.push(
        "S3_PUBLIC_URL is not set. With S3_ENDPOINT the public address of the bucket cannot be derived; set it to where objects are served from, e.g. https://files.example.com.",
      );
    } else if (bucket && region) {
      publicUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
    }
  } else if (!/^https?:\/\/[^/\s]+/i.test(publicUrl)) {
    problems.push(`S3_PUBLIC_URL must be an http(s) address, got "${publicUrl}".`);
  }

  return {
    driver: "s3",
    bucket: bucket ?? "",
    region: region ?? "",
    endpoint,
    accessKeyId: accessKeyId ?? "",
    secretAccessKey: secretAccessKey ?? "",
    publicUrl: publicUrl ?? "",
    keyPrefix: (value(env, "S3_KEY_PREFIX") ?? "").replace(/^\/+|\/+$/g, ""),
    forcePathStyle: (value(env, "S3_FORCE_PATH_STYLE") ?? (endpoint ? "true" : "false")) === "true",
  };
}

export function mailSettings(config: SenloConfig): MailSettings {
  return {
    appUrl: config.appUrl,
    linkSigningSecret: config.linkSigningSecret,
    defaultFromEmail: config.defaultFromEmail,
  };
}
