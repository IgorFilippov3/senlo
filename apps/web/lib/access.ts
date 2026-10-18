import { AccessGuard } from "@senlo/core";
import { ProjectRepository } from "@senlo/db";
import { db } from "apps/web/lib/db";

/**
 * The app's instance of the core access guard. Every action or route that
 * takes an id from the request checks it here before touching the record.
 */
export const access = new AccessGuard(new ProjectRepository(db));
