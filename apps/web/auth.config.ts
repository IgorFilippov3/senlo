import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl, headers } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthRoute =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");
      const isPublicRoute = nextUrl.pathname === "/";

      // 1. Allow API routes with Authorization header (API Keys)
      const isApiRoute =
        nextUrl.pathname.startsWith("/api/v1/") ||
        nextUrl.pathname.startsWith("/api/triggered");
      const hasAuthHeader = headers.has("Authorization");

      if (isApiRoute && hasAuthHeader) {
        return true;
      }

      // 2. Auth routes logic
      if (isAuthRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/projects", nextUrl));
        }
        return true;
      }

      // 3. Protected routes logic
      if (!isLoggedIn && !isPublicRoute) {
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
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;

