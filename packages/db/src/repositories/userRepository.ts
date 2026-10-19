// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { IUserRepository, User } from "@senlo/core";
import * as schema from "../schema";
import { users } from "../schema";

/** Accounts, as `UserService` needs them. Auth.js manages the rest of the table through its adapter. */
export class UserRepository implements IUserRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email));
    return row ? this.mapToEntity(row) : null;
  }

  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({ name: data.name, email: data.email, password: data.passwordHash })
      .returning();
    return this.mapToEntity(row);
  }

  private mapToEntity(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      image: row.image,
      passwordHash: row.password,
    };
  }
}
