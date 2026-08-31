import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import { sendVerificationOtpEmail } from "@/server/modules/email/send-verification-otp";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  session: {
    cookieCache: {
      enabled: false,
    },
  },
  advanced: {
    cookiePrefix: "archivecloud",
    trustedProxyHeaders: true,
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
    database: {
      joins: true,
    },
  },
  trustedOrigins: [env.BETTER_AUTH_URL],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  plugins: [
    emailOTP({
      sendVerificationOnSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        void sendVerificationOtpEmail({ email, otp, type }).catch((error) => {
          console.error("Failed to send verification OTP email:", error);
        });
      },
    }),
  ],
  user: {
    additionalFields: {
      status: {
        type: "string",
        required: false,
        defaultValue: "active",
        input: false,
        returned: true,
      },
      developerModeEnabled: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
        returned: true,
      },
      developerModeEnabledAt: {
        type: "date",
        required: false,
        input: false,
        returned: true,
      },
    },
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
});

export type Auth = typeof auth;
