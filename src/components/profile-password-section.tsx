"use client";

import { Button, Input, toast } from "@heroui/react";
import { Eye, EyeSlash } from "@gravity-ui/icons";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/api";
import { validatePassword } from "@/lib/validate-password";

export function ProfilePasswordSection({
  hasCredentialAccount,
  onCredentialLinked,
}: {
  email: string;
  hasCredentialAccount: boolean;
  isGoogleUser: boolean;
  onCredentialLinked: () => void;
}) {
  const isSettingPassword = !hasCredentialAccount;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function clearPasswordFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage(null);
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

  return (
    <div>
      <h3 className="text-base font-bold text-foreground">
        {isSettingPassword ? "Set password" : "Change password"}
      </h3>

      {isSettingPassword ? (
        <form className="mt-4 grid gap-3" onSubmit={setInitialPassword}>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          {message ? <p className="text-[13px] text-muted">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" isDisabled={saving}>
              {saving ? "Setting..." : "Set password"}
            </Button>
          </div>
        </form>
      ) : (
        <form className="mt-4 grid gap-3" onSubmit={changePassword}>
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrentPassword}
            onToggleShow={() => setShowCurrentPassword((visible) => !visible)}
            placeholder="Current password"
          />
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          {message ? <p className="text-[13px] text-muted">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" isDisabled={saving}>
              {saving ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      )}
    </div>
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
    <label className="grid gap-1.5 text-sm text-foreground">
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
