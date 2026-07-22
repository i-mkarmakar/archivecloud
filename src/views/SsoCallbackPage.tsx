"use client";

import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const HOME_PATH = "/all-files";

export function SsoCallbackPage({ authPath }: { authPath: string }) {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    (async () => {
      if (!clerk.loaded || hasRun.current || !signIn || !signUp) return;
      hasRun.current = true;

      const goHome = (decorateUrl: (url: string) => string) => {
        const url = decorateUrl(HOME_PATH);
        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          router.push(url);
        }
      };

      const finalizeSignIn = async () => {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            goHome(decorateUrl);
          },
        });
      };

      const finalizeSignUp = async () => {
        await signUp.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            goHome(decorateUrl);
          },
        });
      };

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      if (signUp.isTransferable) {
        await signIn.create({ transfer: true });
        const signInStatus = signIn.status as typeof signIn.status | "complete";
        if (signInStatus === "complete") {
          await finalizeSignIn();
          return;
        }
        router.push(authPath);
        return;
      }

      if (
        signIn.status === "needs_first_factor" &&
        !signIn.supportedFirstFactors?.every(
          (factor) => factor.strategy === "enterprise_sso",
        )
      ) {
        router.push(authPath);
        return;
      }

      if (signIn.isTransferable) {
        await signUp.create({ transfer: true });
        if (signUp.status === "complete") {
          await finalizeSignUp();
          return;
        }
        router.push(authPath);
        return;
      }

      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }

      if (
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_new_password"
      ) {
        router.push(authPath);
        return;
      }

      const existingSessionId =
        signIn.existingSession?.sessionId ?? signUp.existingSession?.sessionId;
      if (existingSessionId) {
        await clerk.setActive({
          session: existingSessionId,
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            goHome(decorateUrl);
          },
        });
      }
    })();
  }, [authPath, clerk, router, signIn, signUp]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-secondary p-5">
      <p className="text-sm text-muted">Completing sign-in...</p>
      <div id="clerk-captcha" />
    </main>
  );
}
