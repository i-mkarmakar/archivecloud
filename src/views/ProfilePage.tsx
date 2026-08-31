"use client";

import { Button, Input, toast } from "@heroui/react";
import { Persons } from "@gravity-ui/icons";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/drive/PageHeader";
import { ProfilePasswordSection } from "@/components/profile-password-section";
import { authClient } from "@/lib/auth-client";
import { sessionUserToAuthUser } from "@/lib/auth-user";
import { getGravatarUrl } from "@/lib/gravatar";

type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: Date;
  updatedAt: Date;
};

function providerLabel(providerId: string) {
  if (providerId === "google") return "Google";
  if (providerId === "credential") return "Email & password";
  return providerId;
}

export function ProfilePage() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ? sessionUserToAuthUser(session.user) : null;

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [avatarError, setAvatarError] = useState(false);

  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const hasCredentialAccount = linkedAccounts.some(
    (account) => account.providerId === "credential",
  );
  const isGoogleUser = linkedAccounts.some(
    (account) => account.providerId === "google",
  );

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
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  useEffect(() => {
    setAvatarError(false);
    getGravatarUrl(user?.email, 96)
      .then(setProfileImageUrl)
      .catch(() => setProfileImageUrl(""));
  }, [user?.email]);

  useEffect(() => {
    loadLinkedAccounts().catch(() => undefined);
  }, [loadLinkedAccounts]);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.danger("Display name cannot be empty.");
      return;
    }
    if (trimmed === user?.name) {
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

  if (isPending) {
    return <main className="p-8 text-sm text-muted">Loading profile...</main>;
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your personal information and account security."
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-4">
          <section>
            <div className="flex items-center gap-3.5">
              {!profileImageUrl || avatarError ? (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-accent text-xl font-bold text-accent-foreground shadow-sm border border-border">
                  {(user?.name ?? user?.email ?? "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
              ) : (
                <img
                  src={profileImageUrl}
                  alt="User avatar"
                  className="h-16 w-16 rounded-xl object-cover"
                  onError={() => setAvatarError(true)}
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold">
                  {user?.name ?? "User"}
                </h2>
                <p className="truncate text-xs text-muted mt-0.5">
                  {user?.email ?? "-"}
                </p>
              </div>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={saveName}>
              <div className="grid gap-1.5 text-xs font-semibold text-muted">
                <label htmlFor="profile-display-name">Display name</label>
                <Input
                  id="profile-display-name"
                  fullWidth
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="grid gap-1.5 text-xs font-semibold text-muted">
                <label htmlFor="profile-email">Email</label>
                <Input
                  id="profile-email"
                  fullWidth
                  type="email"
                  value={user?.email ?? ""}
                  readOnly
                />
              </div>
              <p className="text-[12px] text-muted">
                Email changes require verification and are not available yet.
              </p>
              <div className="flex justify-end">
                <Button type="submit" size="sm" isDisabled={savingName}>
                  {savingName ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </section>

          {!loadingAccounts ? (
            <ProfilePasswordSection
              email={user?.email ?? ""}
              hasCredentialAccount={hasCredentialAccount}
              isGoogleUser={isGoogleUser}
              onCredentialLinked={loadLinkedAccounts}
            />
          ) : (
            <section>
              <p className="text-sm text-muted">Loading password settings...</p>
            </section>
          )}
        </div>

        <section className="h-fit">
          <div className="flex items-center gap-2.5">
            <Persons className="h-5 w-5 text-foreground" />
            <h2 className="text-[16px] font-bold">Sign-in methods</h2>
          </div>
          <div className="mt-3 grid gap-2">
            {loadingAccounts ? (
              <p className="text-xs text-muted">Loading...</p>
            ) : linkedAccounts.length === 0 ? (
              <p className="text-xs text-muted">No sign-in methods found.</p>
            ) : (
              linkedAccounts.map((account) => (
                <div key={account.id} className="rounded-xl px-3 py-2 text-xs">
                  <p className="font-semibold text-foreground">
                    {providerLabel(account.providerId)}
                  </p>
                  <p className="mt-0.5 text-muted">Connected to this account</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
