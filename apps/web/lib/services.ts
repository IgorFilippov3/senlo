import { createRepositories, seedNewUser } from "@senlo/db";
import { join } from "node:path";
import { createServices, LocalDiskStorage, type Services } from "@senlo/core/server";
import { getConfig } from "./config";
import { db } from "./db";
import { getMailSettings, getQueues } from "./infra";
import { logger } from "./logger";

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
    logger,
    // Uploads land in Next's public folder, served as /uploads/<name>.
    storage: new LocalDiskStorage(join(process.cwd(), "public/uploads"), "/uploads"),
    // Fill a new account so the dashboard is not empty on arrival.
    onUserCreated: (user) => seedNewUser(db, user.id, { appUrl: getConfig().appUrl }),
  }));
}
