"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export const TURNSTILE_ENABLED = SITE_KEY.length > 0;

export const CAPTCHA_ERROR_MESSAGE = "Verification failed, please try again";

export type TurnstileFieldHandle = {
  reset: () => void;
};

type TurnstileFieldProps = {
  onTokenChange: (token: string | null) => void;
  className?: string;
};

export const TurnstileField = forwardRef<
  TurnstileFieldHandle,
  TurnstileFieldProps
>(function TurnstileField({ onTokenChange, className }, ref) {
  const widgetRef = useRef<TurnstileInstance | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenChange(null);
      widgetRef.current?.reset();
    },
  }));

  if (!TURNSTILE_ENABLED) return null;

  return (
    <div className={cn("flex justify-center", className)}>
      <Turnstile
        ref={widgetRef}
        siteKey={SITE_KEY}
        options={{ theme: "light" }}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => {
          onTokenChange(null);
          widgetRef.current?.reset();
        }}
        onError={() => {
          onTokenChange(null);
          widgetRef.current?.reset();
        }}
      />
    </div>
  );
});

export function captchaFetchOptions(token: string | null | undefined) {
  if (!TURNSTILE_ENABLED || !token) return undefined;
  return {
    headers: {
      "x-captcha-response": token,
    },
  };
}

export function isCaptchaAuthError(
  error:
    | {
        code?: string | null;
        message?: string | null;
      }
    | null
    | undefined,
) {
  if (!error) return false;
  const code = error.code ?? "";
  if (code === "MISSING_RESPONSE" || code === "VERIFICATION_FAILED") {
    return true;
  }
  const message = error.message ?? "";
  return /captcha|missing captcha/i.test(message);
}
