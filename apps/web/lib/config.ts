import { loadSenloConfig, type Env, type SenloConfig } from "@senlo/core";

/**
 * The app's whole configuration, read from the environment once.
 *
 * `SenloConfig` is what the packages need; the rest only this app reads. Every
 * value is read at runtime, never baked in at build: one Docker image serves
 * every install, and changing a variable needs a restart, not a rebuild.
 * Old `NEXT_PUBLIC_*` names are still accepted as fallbacks so existing .env
 * files keep working.
 */
export interface AppConfig extends SenloConfig {
  authSecret: string;
  allowRegistration: boolean;
  /** The public demo instance: loads analytics (with `umamiWebsiteId`). */
  demoMode: boolean;
  github: { clientId: string; clientSecret: string } | null;
  umamiWebsiteId: string | null;
}

const flag = (env: Env, names: string[], fallback: boolean) => {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value === "true";
  }
  return fallback;
};

export function loadAppConfig(env: Env): AppConfig {
  const senlo = loadSenloConfig(env);
  const githubId = env.GITHUB_ID?.trim();
  const githubSecret = env.GITHUB_SECRET?.trim();

  return Object.freeze({
    ...senlo,
    // loadSenloConfig has already refused to start without one of the two.
    authSecret: env.AUTH_SECRET?.trim() || senlo.linkSigningSecret,
    allowRegistration: flag(env, ["ALLOW_REGISTRATION", "NEXT_PUBLIC_ALLOW_REGISTRATION"], true),
    demoMode: flag(env, ["IS_DEMO_MODE", "NEXT_PUBLIC_IS_DEMO_MODE"], false),
    github: githubId && githubSecret ? { clientId: githubId, clientSecret: githubSecret } : null,
    umamiWebsiteId:
      env.UMAMI_WEBSITE_ID?.trim() || env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim() || null,
  });
}

/**
 * During `next build` the secrets are not there and must not be: the image
 * is built once for every install. Build only imports modules to analyse
 * them, so it gets placeholders; the server checks the real config when it
 * starts (instrumentation.ts) and refuses to run with a broken one.
 */
const BUILD_PLACEHOLDERS: Env = {
  DATABASE_URL: "postgres://build-placeholder",
  AUTH_SECRET: "build-placeholder",
  APP_URL: "http://localhost:3000",
};

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (!cached) {
    // A variable, not `process.env.X`: Next.js inlines literal
    // `process.env.NEXT_PUBLIC_*` reads at build time.
    const env: Env = process.env;
    cached =
      env.NEXT_PHASE === "phase-production-build"
        ? loadAppConfig({ ...BUILD_PLACEHOLDERS, ...env, NODE_ENV: "development" })
        : loadAppConfig(env);
  }
  return cached;
}
