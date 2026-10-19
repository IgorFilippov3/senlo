import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "apps/web/lib/db";
import { resetLoginFailures } from "./lib/rate-limit";
import { getConfig } from "./lib/config";
import { getServices, repositories } from "./lib/services";
import { authConfig } from "./auth.config";

const { github } = getConfig();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Closing registration has to close every door. The register action
      // checks the flag and /register returns a 404, but OAuth passes through
      // neither: the adapter creates the account on its own. The same policy
      // check in core decides here.
      if (account?.provider !== "github") return true;
      return getServices().user.mayOAuthSignIn(user.email, getConfig());
    },
  },
  events: {
    // The credentials flow seeds through `UserService.register`. OAuth never
    // reaches that code - the adapter creates the account and only this
    // event fires. Seeding is idempotent, so covering both paths does not
    // seed anyone twice.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const account = await repositories.users.findByEmail(user.email);
      if (account) await getServices().user.afterCreate(account);
    },
  },
  providers: [
    // Registered only when configured, like the button on the login page.
    ...(github ? [GitHub(github)] : []),
    Credentials({
      async authorize(credentials) {
        const user = await getServices().user.verifyCredentials(credentials);
        if (user) {
          // A correct password clears this address's failed attempts.
          await resetLoginFailures(user.email);
        }
        return user;
      },
    }),
  ],
});
