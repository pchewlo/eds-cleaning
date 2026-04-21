import NextAuth from "next-auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "email",
      name: "Email",
      type: "email",
      maxAge: 60 * 60 * 24, // 24 hours
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
          to: email,
          subject: "Sign in to CV Triage",
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
              <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 16px;">Sign in to CV Triage</h2>
              <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                Click the button below to sign in. This link expires in 24 hours.
              </p>
              <a href="${url}" style="display: inline-block; background: #1e293b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">
                Sign in
              </a>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </div>
          `,
        });
      },
    },
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (allowedEmails.length === 0) return true;
      return allowedEmails.includes(user.email.toLowerCase());
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
  },
  session: {
    strategy: "jwt",
  },
});
