import type { NextAuthConfig } from "next-auth";
import { isApiKeyPath, isAuthPath, isPublicPath } from "@senlo/core";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl, headers } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // 1. API routes authenticate with an API key, checked by the route.
      if (isApiKeyPath(pathname) && headers.has("Authorization")) {
        return true;
      }

      // 2. Sign-in pages: a signed-in user is sent home.
      if (isAuthPath(pathname)) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/home", nextUrl));
        }
        return true;
      }

      // 3. Everything else needs a session unless it is public.
      if (!isLoggedIn && !isPublicPath(pathname)) {
        return false; // Redirect to login
      }

      return true;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  providers: [], // Added in auth.ts; this file must stay edge-safe.
} satisfies NextAuthConfig;
