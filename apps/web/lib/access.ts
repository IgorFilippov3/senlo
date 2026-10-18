import { AccessGuard } from "@senlo/core";
import { repositories } from "apps/web/lib/services";

/**
 * The app's instance of the core access guard. Every action or route that
 * takes an id from the request checks it here before touching the record.
 */
export const access = new AccessGuard(repositories.projects);
