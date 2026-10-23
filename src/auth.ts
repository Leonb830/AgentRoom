import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export function authConfigured() {
  return ["AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "AGENTROOM_OWNER_GITHUB", "AGENTROOM_OWNER_GITHUB_ID"]
    .every(key => Boolean(process.env[key]?.trim()));
}
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    async signIn({ profile }) {
      return authConfigured() && String(profile?.id) === process.env.AGENTROOM_OWNER_GITHUB_ID
        && String(profile?.login).toLowerCase() === process.env.AGENTROOM_OWNER_GITHUB?.toLowerCase();
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "github" && profile) token.sub = String(profile.id);
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? "";
      return session;
    }
  }
});
