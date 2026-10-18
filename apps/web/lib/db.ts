import { createDb } from "@senlo/db";
import { getConfig } from "./config";

/**
 * The app's database handle, built from its config. `pg` connects on the
 * first query, so importing this does not open a connection.
 */
export const db = createDb(getConfig().databaseUrl);
