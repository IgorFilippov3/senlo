// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/**
 * A database handle for the given connection string or pool.
 *
 * The package no longer creates one on import, and no longer reads .env
 * files: the app builds its handle from its own config and passes it to the
 * repositories, so a second app can do the same with its own connection.
 * `pg` connects lazily, on the first query.
 */
export function createDb(connection: string | Pool): Database {
  const pool =
    typeof connection === "string"
      ? new Pool({ connectionString: connection })
      : connection;
  return drizzle(pool, { schema });
}
