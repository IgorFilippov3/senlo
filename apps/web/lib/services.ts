import { createRepositories } from "@senlo/db";
import { createServices, type Services } from "@senlo/core/server";
import { db } from "./db";
import { getMailSettings, getQueues } from "./infra";

/**
 * The app's composition root: every repository over the app's database, and
 * every service wired by core's `createServices`. Repositories are cheap and
 * built on import; services are built on first use, because they need the
 * queues and with them the Redis connection.
 */
export const repositories = createRepositories(db);

let services: Services | undefined;

export function getServices(): Services {
  return (services ??= createServices({
    repositories,
    queues: getQueues(),
    settings: getMailSettings(),
  }));
}
