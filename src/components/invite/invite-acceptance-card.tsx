"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type InviteDetails = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  department: string | null;
  section: string | null;
  message: string | null;
  orgName: string;
  className: string | null;
};

type ValidateResult = {
  ok: boolean;
  status: string;
  error?: string;
  invite?: InviteDetails;
};

function createDeviceSessionId() {
  const existing = window.localStorage.getItem("lumina.device.session");
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem("lumina.device.session", id);
  return id;
}

function dashboardPath(
  role: Role,
  onboardingCompleted: boolean,
  pendingApproval = false,
) {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "teacher" && pendingApproval) return "/teacher";
  if (!onboardingCompleted) return `/onboarding/${role}`;
  return `/${role}`;
}

function inviteErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Please check your details.";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("weak-password") ||
    normalized.includes("invalid-password") ||
    normalized.includes("password should")
  ) {
    return "Use a stronger password with at least 8 characters.";
  }

  if (normalized.includes("invalid-email")) {
    return "Enter a valid email address.";
  }

  if (normalized.includes("email-already-exists")) {
    return "This email already has an account. The invite will update its password if the link is valid.";
  }

  return message
    .replaceAll("Firebase: ", "")
    .replaceAll("FirebaseError: ", "")
    .replace(/\s*\(auth\/[^)]+\)\.?/gi, "")
    .trim();
}

export function InviteAcceptanceCard({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });

  const isReady = useMemo(
    () => status === "pending" && invite,
    [status, invite],
  );

  useEffect(() => {
    let mounted = true;

    async function validateInvite() {
      try {
        const response = await fetch("/api/invites/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = (await response.json()) as ValidateResult;

        if (!mounted) return;
        if (!response.ok || !result.invite) {
          throw new Error(result.error ?? "Invite could not be verified.");
        }

        setInvite(result.invite);
        setStatus(result.status);
        setForm((current) => ({
          ...current,
          email: result.invite?.email ?? "",
          displayName: result.invite?.email?.split("@")[0] ?? "",
        }));
      } catch (caught) {
        if (!mounted) return;
        setStatus("invalid");
        setError(
          caught instanceof Error ? caught.message : "Invite unavailable.",
        );
      }
    }

    validateInvite();

    return () => {
      mounted = false;
    };
  }, [token]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          displayName: form.displayName,
          email: form.email,
          password: form.password,
          deviceSessionId: createDeviceSessionId(),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        role?: Role;
        onboardingCompleted?: boolean;
        pendingApproval?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok || !result.role) {
        throw new Error(result.error ?? "Invite could not be accepted.");
      }

      window.localStorage.setItem("lumina.active.role", result.role);
      toast.success("Workspace joined.");
      router.replace(
        dashboardPath(
          result.role,
          Boolean(result.onboardingCompleted),
          Boolean(result.pendingApproval),
        ),
      );
    } catch (caught) {
      toast.error("Invite acceptance failed", {
        description: inviteErrorMessage(caught),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl overflow-hidden">
      <CardHeader className="p-6 md:p-8">
        <Badge className="mb-3 w-fit">
          <ShieldCheck className="size-3" />
          Secure invitation
        </Badge>
        <CardTitle className="text-3xl md:text-5xl">
          {invite?.orgName ?? "EduPulse invitation"}
        </CardTitle>
        <CardDescription className="max-w-xl leading-7">
          {status === "loading"
            ? "Checking your invitation..."
            : isReady
              ? "Create your account to join the right role, class, and institution."
              : "This invite cannot be used. Ask your institution admin for a fresh link."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6 pt-0 md:p-8 md:pt-0">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-border bg-background/60 p-4">
            <p className="text-sm text-muted-foreground">Role</p>
            <p className="mt-2 font-semibold capitalize">
              {invite?.role?.replace("_", " ") ?? "Checking"}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-background/60 p-4">
            <p className="text-sm text-muted-foreground">Class</p>
            <p className="mt-2 font-semibold">
              {invite?.className ?? invite?.department ?? "Institution"}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-background/60 p-4">
            <p className="text-sm text-muted-foreground">Expires</p>
            <p className="mt-2 font-semibold">
              {invite ? formatDate(invite.expiresAt) : "Checking"}
            </p>
          </div>
        </div>

        {invite?.message && (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 p-5">
            <p className="text-sm leading-6 text-muted-foreground">
              {invite.message}
            </p>
          </div>
        )}

        {!isReady && (
          <div className="flex items-center gap-3 rounded-3xl border border-border bg-background/60 p-5">
            <div className="grid size-11 place-items-center rounded-2xl bg-amber-500/12 text-amber-500">
              <Clock />
            </div>
            <div>
              <p className="font-semibold">
                {status === "loading"
                  ? "Verifying invite"
                  : "Invite unavailable"}
              </p>
              <p className="text-sm text-muted-foreground">
                {error ?? `Current invite status: ${status}`}
              </p>
            </div>
          </div>
        )}

        {isReady && (
          <form className="space-y-4" onSubmit={acceptInvite}>
            <Input
              required
              value={form.displayName}
              onChange={(event) =>
                updateField("displayName", event.target.value)
              }
              placeholder="Full name"
            />
            <Input
              required
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="Email"
            />
            <Input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="Create password"
            />
            <Button className="w-full" disabled={busy} variant="premium">
              <KeyRound /> {busy ? "Joining..." : "Join workspace"}
              <ArrowRight />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
