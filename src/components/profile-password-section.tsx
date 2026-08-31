"use client";

import { Button, Input, toast } from "@heroui/react";
import { Eye, EyeSlash, Key } from "@gravity-ui/icons";
import { type FormEvent, useEffect, useState } from "react";
import { OtpInput } from "@/components/auth/otp-input";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/api";
import { validatePassword } from "@/lib/validate-password";

type PasswordMode = "change" | "otp-reset";

export function ProfilePasswordSection({
  email,
  hasCredentialAccount,
  isGoogleUser,
  onCredentialLinked,
}: {
  email: string;
  hasCredentialAccount: boolean;
  isGoogleUser: boolean;
  onCredentialLinked: () => void;
}) {
  const isSettingPassword = !hasCredentialAccount;
  const [mode, setMode] = useState<PasswordMode>("change");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function clearPasswordFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setOtp("");
    setMessage(null);
  }

  function switchToOtpReset() {
    setMode("otp-reset");
    clearPasswordFields();
    setOtpSent(false);
  }

  function switchToChangePassword() {
    setMode("change");
    clearPasswordFields();
    setOtpSent(false);
  }

  async function sendResetCode() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.danger("No email address on this account.");
      return;
    }

    setSendingCode(true);
    setMessage(null);
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email: trimmedEmail,
    });
    setSendingCode(false);

    if (error) {
      toast.danger(error.message ?? "Failed to send reset code.");
      return;
    }

    setOtpSent(true);
    setResendSeconds(60);
    setMessage("If your account supports email login, a reset code was sent.");
    toast.success("Reset code sent.");
  }

  async function setInitialPassword(event: FormEvent) {
    event.preventDefault();
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Password and confirmation do not match.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await apiFetch("/account/set-password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      setNewPassword("");
      setConfirmPassword("");
      setMessage(
        "Password set. You can now sign in with your email and password.",
      );
      toast.success("Password set.");
      onCredentialLinked();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to set password.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword) {
      setMessage("Current password is required.");
      return;
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        setMessage(error.message ?? "Failed to update password.");
        return;
      }
      clearPasswordFields();
      setMessage("Password updated. Other sessions were signed out.");
      toast.success("Password updated.");
    } finally {
      setSaving(false);
    }
  }

  async function resetPasswordWithOtp(event: FormEvent) {
    event.preventDefault();
    if (!otpSent) {
      await sendResetCode();
      return;
    }
    if (otp.trim().length < 6) {
      setMessage("Enter the 6-digit code from your email.");
      return;
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const { error } = await authClient.emailOtp.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        password: newPassword,
      });
      if (error) {
        setMessage(error.message ?? "Failed to reset password.");
        return;
      }
      clearPasswordFields();
      setOtpSent(false);
      setMode("change");
      setMessage("Password reset. You can sign in with your new password.");
      toast.success("Password reset.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2.5">
        <Key className="h-5 w-5 text-foreground" />
        <h2 className="text-[16px] font-bold">
          {isSettingPassword ? "Set password" : "Password"}
        </h2>
      </div>

      {isSettingPassword && isGoogleUser ? (
        <p className="mt-1 text-[13px] text-muted">
          You signed up with Google. Set a password to also sign in with your
          email and password.
        </p>
      ) : null}

      {!isSettingPassword && isGoogleUser ? (
        <p className="mt-1 text-[13px] text-muted">
          You can also sign in with Google. Password changes apply to email
          login.
        </p>
      ) : null}

      {!isSettingPassword && mode === "change" ? (
        <p className="mt-1 text-[13px] text-muted">
          Update your password with your current password, or reset it using an
          email code.
        </p>
      ) : null}

      {!isSettingPassword && mode === "otp-reset" ? (
        <p className="mt-1 text-[13px] text-muted">
          We&apos;ll send a one-time code to {email} to reset your password.
        </p>
      ) : null}

      {isSettingPassword ? (
        <form className="mt-4 grid gap-3" onSubmit={setInitialPassword}>
          <PasswordField
            label="Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNewPassword}
            onToggleShow={() => setShowNewPassword((visible) => !visible)}
            placeholder="New password"
          />
          <PasswordField
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirmPassword}
            onToggleShow={() => setShowConfirmPassword((visible) => !visible)}
            placeholder="Confirm password"
          />
          {message ? <p className="text-[13px] text-muted">{message}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onPress={clearPasswordFields}
            >
              Reset
            </Button>
            <Button type="submit" size="sm" isDisabled={saving}>
              {saving ? "Setting..." : "Set password"}
            </Button>
          </div>
        </form>
      ) : mode === "change" ? (
        <form className="mt-4 grid gap-3" onSubmit={changePassword}>
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrentPassword}
            onToggleShow={() => setShowCurrentPassword((visible) => !visible)}
            placeholder="Current password"
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNewPassword}
            onToggleShow={() => setShowNewPassword((visible) => !visible)}
            placeholder="New password"
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirmPassword}
            onToggleShow={() => setShowConfirmPassword((visible) => !visible)}
            placeholder="Confirm new password"
          />
          {message ? <p className="text-[13px] text-muted">{message}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
              onClick={switchToOtpReset}
            >
              Reset with email code
            </button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onPress={clearPasswordFields}
              >
                Reset
              </Button>
              <Button type="submit" size="sm" isDisabled={saving}>
                {saving ? "Updating..." : "Update password"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <form className="mt-4 grid gap-3" onSubmit={resetPasswordWithOtp}>
          <div className="grid gap-1.5 text-xs font-semibold text-muted">
            <span>Email</span>
            <Input fullWidth type="email" value={email} readOnly />
          </div>

          {otpSent ? (
            <>
              <div className="grid gap-1.5 text-xs font-semibold text-muted">
                <span>Verification code</span>
                <OtpInput value={otp} onChange={setOtp} autoFocus />
              </div>
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNewPassword}
                onToggleShow={() => setShowNewPassword((visible) => !visible)}
                placeholder="New password"
              />
              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showConfirmPassword}
                onToggleShow={() =>
                  setShowConfirmPassword((visible) => !visible)
                }
                placeholder="Confirm new password"
              />
            </>
          ) : null}

          {message ? <p className="text-[13px] text-muted">{message}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
              onClick={switchToChangePassword}
            >
              Use current password instead
            </button>
            <div className="flex flex-wrap gap-2">
              {otpSent ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  isDisabled={sendingCode || resendSeconds > 0}
                  onPress={sendResetCode}
                >
                  {resendSeconds > 0
                    ? `Resend in ${resendSeconds}s`
                    : "Resend code"}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onPress={clearPasswordFields}
              >
                Reset
              </Button>
              <Button
                type="submit"
                size="sm"
                isDisabled={saving || sendingCode}
              >
                {saving
                  ? "Updating..."
                  : otpSent
                    ? "Reset password"
                    : sendingCode
                      ? "Sending..."
                      : "Send reset code"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-muted">
      {label}
      <div className="relative">
        <Input
          fullWidth
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          minLength={8}
          className="pr-10"
          required
        />
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
          onClick={onToggleShow}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <EyeSlash className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </label>
  );
}
