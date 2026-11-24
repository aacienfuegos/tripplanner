import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { safeCallbackUrl } from "@/lib/oauth/callback-url";

const providers: NextAuthConfig["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/auth");
      if (isAuthPage) return true;
      if (isLoggedIn) return true;
      const signIn = new URL("/auth/signin", nextUrl);
      // An agent's authorization request comes back to the consent screen
      // after signing in. The sign-in page checks it again before using it.
      if (nextUrl.pathname === "/oauth/authorize") {
        signIn.searchParams.set("callbackUrl", safeCallbackUrl(nextUrl.pathname + nextUrl.search));
      }
      return Response.redirect(signIn);
    },
  },
};
