import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { upgradeProfileImageUrl } from "@/lib/gravatar";
import { env } from "@/server/config/env";
import { prisma } from "@/server/config/prisma";
import {
  getAdminName,
  getDefaultUserPlan,
  isAdminEmail,
} from "@/server/modules/billing/admin";
import { sendVerificationOtpEmail } from "@/server/modules/email/send-verification-otp";
import { subscribeUserToNewsletter } from "@/server/modules/newsletter/subscribe";

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
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    "http://localhost:9050",
    "http://127.0.0.1:9050",
    // ngrok (static free domain + legacy hosts) for local webhook testing
    "*.ngrok-free.app",
    "https://*.ngrok-free.app",
    "*.ngrok.app",
    "https://*.ngrok.app",
    "*.ngrok.io",
    "https://*.ngrok.io",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const admin = isAdminEmail(user.email);
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                planId: admin ? "thunder" : getDefaultUserPlan(),
                ...(admin && getAdminName() ? { name: getAdminName()! } : {}),
              },
            });
          } catch (error) {
            console.error("Failed to apply instance account defaults:", error);
          }

          try {
            await subscribeUserToNewsletter({
              userId: user.id,
              email: user.email,
              source: "signup",
            });
          } catch (error) {
            console.error("Failed to subscribe user to newsletter:", error);
          }
        },
      },
    },
  },
  plugins: [
    emailOTP({
      sendVerificationOnSignUp: true,
      changeEmail: {
        enabled: true,
      },
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
  account: {
    accountLinking: {
      enabled: true,
      updateUserInfoOnLink: true,
    },
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            mapProfileToUser: (profile) => ({
              name: profile.name,
              email: profile.email,
              image: profile.picture
                ? upgradeProfileImageUrl(profile.picture, 512)
                : profile.picture,
              emailVerified: profile.email_verified,
            }),
          },
        }
      : {},
});

export type Auth = typeof auth;
