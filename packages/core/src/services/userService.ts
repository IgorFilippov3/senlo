// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import bcrypt from "bcryptjs";
import { z } from "zod";
import type { User } from "../domain";
import { AppError, FormValidationError } from "../errors";
import { consoleLogger, type Logger } from "../logger";
import type { IUserRepository } from "../ports";
import { parseInput } from "../validation";

/** The one password rule, for registration and sign-in alike. */
export const PASSWORD_MIN_LENGTH = 6;

export const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
});

export const CredentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/** The user as a session sees it: never the password hash. */
export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export const bcryptHasher: PasswordHasher = {
  hash: (password) => bcrypt.hash(password, 10),
  compare: (password, hash) => bcrypt.compare(password, hash),
};

export class RegistrationClosedError extends AppError {
  constructor() {
    super("FORBIDDEN", "Registration is disabled on this instance.");
    this.name = "RegistrationClosedError";
  }
}

export interface UserServiceOptions {
  /**
   * Runs after an account is created, for seeding a first workspace and the
   * like. A failure here is logged, not surfaced: the account exists either
   * way, and an empty dashboard is recoverable where a dead sign-up is not.
   */
  onUserCreated?: (user: User) => Promise<void>;
  logger?: Logger;
}

function toSessionUser(user: User): SessionUser {
  return { id: user.id, name: user.name, email: user.email, image: user.image };
}

/** Accounts: registration with the instance's policy, and credentials sign-in. */
export class UserService {
  private readonly logger: Logger;

  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: PasswordHasher = bcryptHasher,
    private readonly options: UserServiceOptions = {},
  ) {
    this.logger = options.logger ?? consoleLogger;
  }

  /**
   * Creates an account from raw form fields. `allowRegistration` is the
   * instance's policy and is checked here so that every sign-up door - the
   * form and OAuth - is closed by the same rule.
   */
  async register(rawInput: unknown, policy: { allowRegistration: boolean }): Promise<SessionUser> {
    if (!policy.allowRegistration) throw new RegistrationClosedError();

    const input = parseInput(RegisterSchema, rawInput);
    if (await this.users.findByEmail(input.email)) {
      throw FormValidationError.field("email", "Email already in use");
    }

    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.hasher.hash(input.password),
    });
    await this.afterCreate(user);
    return toSessionUser(user);
  }

  /** The user for correct credentials; null for anything else, with no hint why. */
  async verifyCredentials(rawCredentials: unknown): Promise<SessionUser | null> {
    const parsed = CredentialsSchema.safeParse(rawCredentials);
    if (!parsed.success) return null;

    const user = await this.users.findByEmail(parsed.data.email);
    if (!user?.passwordHash) return null;

    const ok = await this.hasher.compare(parsed.data.password, user.passwordHash);
    return ok ? toSessionUser(user) : null;
  }

  /**
   * Whether an OAuth sign-in may proceed under the registration policy:
   * existing accounts always may, new ones only while registration is open.
   */
  async mayOAuthSignIn(email: string | null | undefined, policy: { allowRegistration: boolean }): Promise<boolean> {
    if (policy.allowRegistration) return true;
    if (!email) return false;
    return Boolean(await this.users.findByEmail(email));
  }

  /** For accounts created outside `register` (an OAuth adapter), so they are seeded the same way. */
  async afterCreate(user: User): Promise<void> {
    if (!this.options.onUserCreated) return;
    try {
      await this.options.onUserCreated(user);
    } catch (error) {
      this.logger.error("Failed to set up a new account", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
