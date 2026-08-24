import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import NeonAdapter from "@auth/neon-adapter";
import { getPool, isDatabaseConfigured } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: isDatabaseConfigured() ? NeonAdapter(getPool()) : undefined,
  providers: [Google],
  pages: { signIn: "/signin" },
  session: { strategy: isDatabaseConfigured() ? "database" : "jwt" },
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
