import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, users, seedNewUser } from "@senlo/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { logger } from "./lib/logger";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Closing registration has to close every door. `registerAction` checks
      // the flag and /register returns a 404, but OAuth passes through
      // neither: the adapter creates the account on its own, so an instance
      // with GitHub credentials configured would keep taking new sign-ups
      // after the operator believed registration was off. People who already
      // have an account still get in.
      //
      // This reads the same plain variable `registerAction` enforces rather
      // than the NEXT_PUBLIC_ twin, which Next.js inlines at build time — a
      // security check must not be decided by what the build machine had.
      if (
        account?.provider !== "github" ||
        process.env.ALLOW_REGISTRATION !== "false"
      ) {
        return true;
      }

      if (!user.email) {
        return false;
      }

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, user.email));

      return Boolean(existing);
    },
  },
  events: {
    // The credentials flow seeds from `registerAction`, which inserts its user
    // itself. OAuth never reaches that code — the adapter creates the account
    // and only this event fires. `seedNewUser` is idempotent, so covering both
    // paths does not seed anyone twice.
    async createUser({ user }) {
      if (!user.id) {
        return;
      }

      try {
        await seedNewUser(user.id);
      } catch (error) {
        // An empty dashboard is a far smaller problem than a sign-up that
        // fails after the account has already been created.
        logger.error("Failed to seed a new account", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

          if (!user || !user.password) return null;

          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (passwordsMatch) {
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            };
          }
        }

        return null;
      },
    }),
  ],
});
