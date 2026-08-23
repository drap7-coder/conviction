import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import NeonAdapter from "@auth/neon-adapter";
import { getPool, isDatabaseConfigured } from "@/lib/db";
import { isAuthConfigured } from "@/lib/auth-readiness";

const databaseReady = isDatabaseConfigured() && isAuthConfigured();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: databaseReady ? NeonAdapter(getPool()) : undefined,
  providers: [GitHub],
  session: { strategy: databaseReady ? "database" : "jwt" },
  trustHost: true,
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? token?.sub ?? "";
      }
      return session;
    },
  },
});
