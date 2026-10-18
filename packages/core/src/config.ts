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
  /** Sender when a trigger or campaign does not set one. */
  defaultFromEmail: string;
}

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
 * Required: `DATABASE_URL`, `AUTH_SECRET` (or `LINK_SIGNING_SECRET`), and
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

  const defaultFromEmail = value(env, "DEFAULT_FROM_EMAIL") ?? "hello@senlo.io";
  if (!SINGLE_ADDRESS.test(defaultFromEmail)) {
    problems.push(
      `DEFAULT_FROM_EMAIL must be a single plain address, got "${defaultFromEmail}".`,
    );
  }

  if (problems.length > 0) throw new ConfigError(problems);

  return Object.freeze({
    appUrl,
    databaseUrl: databaseUrl!,
    redisUrl: value(env, "REDIS_URL") ?? "redis://localhost:6379",
    queuePrefix: value(env, "REDIS_QUEUE_PREFIX") ?? "senlo",
    linkSigningSecret: linkSigningSecret!,
    defaultFromEmail,
  });
}

export function mailSettings(config: SenloConfig): MailSettings {
  return {
    appUrl: config.appUrl,
    linkSigningSecret: config.linkSigningSecret,
    defaultFromEmail: config.defaultFromEmail,
  };
}
