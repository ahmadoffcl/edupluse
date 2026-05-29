"use client";

import { type ChangeEvent, useState } from "react";
import { updateProfile } from "firebase/auth";
import {
  Bell,
  Camera,
  LockKeyhole,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { ProfileSettingsData } from "@/lib/dashboard/profile-settings";
import { initials } from "@/lib/utils";

export function ProfileSettingsPanel({
  data,
  role,
}: {
  data: ProfileSettingsData;
  role: "student" | "teacher";
}) {
  const [form, setForm] = useState({
    displayName: data.displayName,
    username: data.username ? `@${data.username}` : "",
    phone: data.phone ?? "",
    bio: data.bio ?? "",
    avatarUrl: data.avatarUrl ?? "",
    notifications: data.notifications,
    weeklyDigest: data.weeklyDigest,
    publicLeaderboard: data.publicLeaderboard,
  });
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const { updateUserProfile } = useAuth();

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);

    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to save profile.");
      }

      toast.success("Profile settings saved");
      updateUserProfile({
        displayName: form.displayName,
        photoURL: form.avatarUrl || null,
      });
      const auth = getFirebaseAuth();
      if (auth?.currentUser) {
        void updateProfile(auth.currentUser, {
          displayName: form.displayName,
          photoURL: form.avatarUrl || null,
        }).catch(() => undefined);
      }
    } catch (error) {
      toast.error("Settings could not be saved", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => null)) as {
        avatarUrl?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.avatarUrl) {
        throw new Error(payload?.error ?? "Unable to upload profile image.");
      }

      update("avatarUrl", payload.avatarUrl);
      updateUserProfile({ photoURL: payload.avatarUrl });
      const auth = getFirebaseAuth();
      if (auth?.currentUser) {
        void updateProfile(auth.currentUser, {
          photoURL: payload.avatarUrl,
        }).catch(() => undefined);
      }
      toast.success("Profile image updated");
    } catch (error) {
      toast.error("Profile image could not be updated", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      event.target.value = "";
      setAvatarBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <Card className="overflow-hidden">
          <div className="h-28 bg-[linear-gradient(135deg,var(--primary),transparent_55%),linear-gradient(315deg,var(--accent),transparent_45%)] opacity-80" />
          <CardContent className="-mt-12 p-6">
            <div className="flex items-end gap-4">
              <div className="grid size-24 place-items-center overflow-hidden rounded-[2rem] border border-border bg-background text-2xl font-semibold text-primary shadow-xl">
                {form.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={form.avatarUrl}
                  />
                ) : (
                  initials(form.displayName)
                )}
              </div>
              <div className="mb-2 space-y-2">
                <Badge className="capitalize">{role}</Badge>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-semibold transition hover:bg-muted">
                  <Upload className="size-3.5" />
                  {avatarBusy ? "Uploading..." : "Upload photo"}
                  <input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={avatarBusy}
                    type="file"
                    onChange={uploadAvatar}
                  />
                </label>
              </div>
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">
              {form.displayName || "EduPulse user"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{data.email}</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-primary" />
                  Account visibility
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Public identity appears in classes, messages, leaderboards,
                  and assignment activity.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <LockKeyhole className="size-4 text-primary" />
                  Secure session
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Password changes still happen through Firebase reset flows.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="size-5 text-primary" />
              Profile identity
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold">Display name</span>
              <Input
                value={form.displayName}
                onChange={(event) => update("displayName", event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Username</span>
              <Input
                placeholder="@username"
                value={form.username}
                onChange={(event) => update("username", event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Phone</span>
              <Input
                placeholder="0300 0000000"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Profile image URL</span>
              <Input
                placeholder="https://..."
                value={form.avatarUrl}
                onChange={(event) => update("avatarUrl", event.target.value)}
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold">Bio</span>
              <Textarea
                placeholder={
                  role === "teacher"
                    ? "Teaching focus, office rhythm, and class style"
                    : "Learning goals, status, or class identity"
                }
                value={form.bio}
                onChange={(event) => update("bio", event.target.value)}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5 text-primary" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {[
              ["notifications", "Smart notifications"],
              ["weeklyDigest", "Weekly digest"],
              ["publicLeaderboard", "Leaderboard identity"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 p-4 text-sm font-semibold"
              >
                {label}
                <input
                  checked={Boolean(form[key as keyof typeof form])}
                  className="size-5 accent-primary"
                  type="checkbox"
                  onChange={(event) =>
                    update(
                      key as
                        | "notifications"
                        | "weeklyDigest"
                        | "publicLeaderboard",
                      event.target.checked,
                    )
                  }
                />
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button disabled={busy} variant="premium" onClick={save}>
            <Save /> {busy ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
