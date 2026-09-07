"use client";

import { Camera, Xmark } from "@gravity-ui/icons";
import { Button, Input, toast } from "@heroui/react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GoogleLogo } from "@/components/auth/GoogleLogo";
import { OtpInput } from "@/components/auth/otp-input";
import { DummyModal } from "@/components/drive/DummyModal";
import { PageHeader } from "@/components/drive/PageHeader";
import { ProfilePasswordSection } from "@/components/profile-password-section";
import { authClient } from "@/lib/auth-client";
import { sessionUserToAuthUser } from "@/lib/auth-user";
import { getProfileImageUrl } from "@/lib/gravatar";
import { fileToAvatarDataUrl } from "@/lib/profile-avatar";
import { syncGoogleProfileImageIfNeeded } from "@/lib/sync-google-avatar";

type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: Date;
  updatedAt: Date;
};

function splitDisplayName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function joinDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export function ProfilePage() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ? sessionUserToAuthUser(session.user) : null;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);

  const hasCredentialAccount = linkedAccounts.some(
    (account) => account.providerId === "credential",
  );
  const isGoogleUser = linkedAccounts.some(
    (account) => account.providerId === "google",
  );

  const initialNames = useMemo(
    () => splitDisplayName(user?.name ?? ""),
    [user?.name],
  );

  const nameDirty =
    firstName.trim() !== initialNames.firstName ||
    lastName.trim() !== initialNames.lastName;
  const canSaveName = nameDirty && Boolean(firstName.trim()) && !savingName;

  const loadLinkedAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await authClient.listAccounts();
      if (error) {
        toast.danger(error.message ?? "Failed to load sign-in methods");
        return;
      }
      setLinkedAccounts((data ?? []) as LinkedAccount[]);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    const names = splitDisplayName(user?.name ?? "");
    setFirstName(names.firstName);
    setLastName(names.lastName);
  }, [user?.name]);

  useEffect(() => {
    setAvatarError(false);
    setProfileImageUrl(
      getProfileImageUrl({
        image: user?.image,
        email: user?.email,
        size: 512,
      }),
    );

    void syncGoogleProfileImageIfNeeded(user?.image).then((image) => {
      if (image) {
        setProfileImageUrl(image);
        setAvatarError(false);
      }
    });
  }, [user?.image, user?.email]);

  useEffect(() => {
    loadLinkedAccounts().catch(() => undefined);
  }, [loadLinkedAccounts]);

  async function onAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setSavingAvatar(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      const { error } = await authClient.updateUser({ image: dataUrl });
      if (error) {
        toast.danger(error.message ?? "Failed to update profile photo");
        return;
      }
      setProfileImageUrl(dataUrl);
      setAvatarError(false);
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.danger(
        error instanceof Error ? error.message : "Failed to update photo",
      );
    } finally {
      setSavingAvatar(false);
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const trimmed = joinDisplayName(firstName, lastName);
    if (!firstName.trim()) {
      toast.danger("First name cannot be empty.");
      return;
    }
    if (trimmed === (user?.name ?? "").trim()) {
      toast.info("No changes to save.");
      return;
    }

    setSavingName(true);
    try {
      const { error } = await authClient.updateUser({ name: trimmed });
      if (error) {
        toast.danger(error.message ?? "Failed to update profile");
        return;
      }
      toast.success("Profile updated.");
    } finally {
      setSavingName(false);
    }
  }

  async function unlinkSignInMethod(account: LinkedAccount) {
    if (linkedAccounts.length <= 1) {
      toast.danger("You cannot remove your only sign-in method.");
      return;
    }

    setUnlinkingId(account.id);
    try {
      const { error } = await authClient.unlinkAccount({
        accountId: account.id,
      });
      if (error) {
        toast.danger(error.message ?? "Failed to unlink sign-in method");
        return;
      }
      toast.success("Sign-in method removed.");
      await loadLinkedAccounts();
    } finally {
      setUnlinkingId(null);
    }
  }

  function resetChangeEmailForm() {
    setNewEmail("");
    setEmailOtp("");
    setEmailOtpSent(false);
  }

  async function requestChangeEmailOtp() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      toast.danger("Enter a new email address.");
      return;
    }
    if (trimmed === (user?.email ?? "").toLowerCase()) {
      toast.info("That is already your email address.");
      return;
    }

    setSendingEmailOtp(true);
    try {
      const { error } = await authClient.emailOtp.requestEmailChange({
        newEmail: trimmed,
      });
      if (error) {
        toast.danger(error.message ?? "Failed to send verification code.");
        return;
      }
      setEmailOtpSent(true);
      setEmailOtp("");
      toast.success("Verification code sent to your new email.");
    } finally {
      setSendingEmailOtp(false);
    }
  }

  async function submitChangeEmail(event: FormEvent) {
    event.preventDefault();
    const trimmed = newEmail.trim().toLowerCase();
    if (!emailOtpSent) {
      await requestChangeEmailOtp();
      return;
    }
    if (emailOtp.trim().length < 6) {
      toast.danger("Enter the 6-digit code from your new email.");
      return;
    }

    setSavingEmail(true);
    try {
      const { error } = await authClient.emailOtp.changeEmail({
        newEmail: trimmed,
        otp: emailOtp.trim(),
      });
      if (error) {
        toast.danger(error.message ?? "Failed to change email.");
        return;
      }
      toast.success("Email updated.");
      setChangeEmailOpen(false);
      resetChangeEmailForm();
    } finally {
      setSavingEmail(false);
    }
  }

  if (isPending) {
    return <main className="p-8 text-sm text-muted">Loading profile...</main>;
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your personal information and account security."
      />

      <div className="mt-5 max-w-3xl">
        <h2 className="text-lg font-bold text-foreground">
          Personal information
        </h2>

        <div className="mt-5 flex flex-col gap-2">
          <div className="group relative size-24 shrink-0 overflow-hidden rounded-full">
            <div className="size-24 overflow-hidden rounded-full border border-border bg-background">
              {!profileImageUrl || avatarError ? (
                <span className="flex h-full w-full items-center justify-center bg-accent text-2xl font-bold text-accent-foreground">
                  {(user?.name ?? user?.email ?? "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </span>
              ) : (
                <img
                  src={profileImageUrl}
                  alt="User"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              )}
            </div>
            <button
              type="button"
              className="absolute inset-x-0 bottom-0 z-10 flex h-1/2 w-full cursor-pointer items-center justify-center rounded-b-full border-0 bg-black/40 p-0 opacity-0 shadow-none transition-opacity hover:bg-black/50 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
              onClick={() => avatarInputRef.current?.click()}
              disabled={savingAvatar}
              aria-label="Change photo"
            >
              <Camera className="size-5 text-white" aria-hidden />
              <span className="sr-only">Change photo</span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              className="hidden"
              onChange={onAvatarFileChange}
            />
          </div>
          <p className="text-sm text-muted">
            {savingAvatar ? "Updating photo..." : ".jpg or .png, max 1MB"}
          </p>
        </div>

        <form className="mt-6" onSubmit={saveName}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid min-w-0 flex-1 basis-40 gap-1.5 text-sm text-muted">
              <label htmlFor="profile-first-name">First name</label>
              <Input
                id="profile-first-name"
                fullWidth
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                required
              />
            </div>
            <div className="grid min-w-0 flex-1 basis-40 gap-1.5 text-sm text-muted">
              <label htmlFor="profile-last-name">Last name</label>
              <Input
                id="profile-last-name"
                fullWidth
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="min-w-32 shrink-0 px-10"
              isDisabled={!canSaveName}
            >
              {savingName ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>

        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="profile-email" className="text-sm text-muted">
              Email
            </label>
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => {
                resetChangeEmailForm();
                setChangeEmailOpen(true);
              }}
            >
              Change email
            </button>
          </div>
          <Input
            id="profile-email"
            fullWidth
            type="email"
            value={user?.email ?? ""}
            readOnly
            className="opacity-70"
          />
        </div>

        <div className="mt-8">
          <h3 className="text-base font-bold text-foreground">
            Sign-in methods
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {loadingAccounts ? (
              <p className="text-sm text-muted">Loading...</p>
            ) : linkedAccounts.length === 0 ? (
              <p className="text-sm text-muted">No sign-in methods found.</p>
            ) : (
              linkedAccounts.map((account) => (
                <SignInMethodChip
                  key={account.id}
                  account={account}
                  email={user?.email ?? ""}
                  canUnlink={linkedAccounts.length > 1}
                  isUnlinking={unlinkingId === account.id}
                  onUnlink={() => unlinkSignInMethod(account)}
                />
              ))
            )}
          </div>
        </div>

        <div className="mt-10">
          {!loadingAccounts ? (
            <ProfilePasswordSection
              email={user?.email ?? ""}
              hasCredentialAccount={hasCredentialAccount}
              isGoogleUser={isGoogleUser}
              onCredentialLinked={loadLinkedAccounts}
            />
          ) : (
            <p className="text-sm text-muted">Loading password settings...</p>
          )}
        </div>
      </div>

      <DummyModal
        open={changeEmailOpen}
        title="Change email"
        description={
          emailOtpSent
            ? `Enter the 6-digit code sent to ${newEmail.trim()}.`
            : "Enter a new email address. We’ll send a verification code there."
        }
        onClose={() => {
          if (!savingEmail && !sendingEmailOtp) {
            setChangeEmailOpen(false);
            resetChangeEmailForm();
          }
        }}
      >
        <form className="grid gap-4" onSubmit={submitChangeEmail}>
          <div className="grid gap-1.5 text-sm text-muted">
            <label htmlFor="profile-new-email">New email</label>
            <Input
              id="profile-new-email"
              fullWidth
              type="email"
              value={newEmail}
              onChange={(event) => {
                setNewEmail(event.target.value);
                if (emailOtpSent) {
                  setEmailOtpSent(false);
                  setEmailOtp("");
                }
              }}
              placeholder="you@example.com"
              autoComplete="email"
              required
              autoFocus={!emailOtpSent}
              disabled={savingEmail}
            />
          </div>

          {emailOtpSent ? (
            <div className="grid gap-1.5 text-sm text-muted">
              <span>Verification code</span>
              <OtpInput
                value={emailOtp}
                onChange={setEmailOtp}
                autoFocus
                isDisabled={savingEmail}
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              isDisabled={savingEmail || sendingEmailOtp}
              onPress={() => {
                setChangeEmailOpen(false);
                resetChangeEmailForm();
              }}
            >
              Cancel
            </Button>
            {emailOtpSent ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                isDisabled={savingEmail || sendingEmailOtp}
                onPress={requestChangeEmailOtp}
              >
                {sendingEmailOtp ? "Sending..." : "Resend code"}
              </Button>
            ) : null}
            <Button
              type="submit"
              size="sm"
              isDisabled={savingEmail || sendingEmailOtp}
            >
              {savingEmail
                ? "Updating..."
                : sendingEmailOtp
                  ? "Sending..."
                  : emailOtpSent
                    ? "Update email"
                    : "Send code"}
            </Button>
          </div>
        </form>
      </DummyModal>
    </>
  );
}

function SignInMethodChip({
  account,
  email,
  canUnlink,
  isUnlinking,
  onUnlink,
}: {
  account: LinkedAccount;
  email: string;
  canUnlink: boolean;
  isUnlinking: boolean;
  onUnlink: () => void;
}) {
  const isGoogle = account.providerId === "google";
  const label =
    account.providerId === "credential"
      ? email || "Email & password"
      : email || account.accountId;

  return (
    <div className="inline-flex max-w-full items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
      {isGoogle ? (
        <GoogleLogo className="h-4 w-4 shrink-0" />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-bold text-muted">
          @
        </span>
      )}
      <span className="min-w-0 truncate">{label}</span>
      {canUnlink ? (
        <button
          type="button"
          className="ml-0.5 shrink-0 text-muted transition-colors hover:text-foreground disabled:opacity-50"
          aria-label={`Remove ${isGoogle ? "Google" : "email"} sign-in`}
          disabled={isUnlinking}
          onClick={onUnlink}
        >
          <Xmark className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
