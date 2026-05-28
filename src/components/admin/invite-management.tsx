"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Link2, MailPlus, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/content-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { AdminInvitesData } from "@/lib/dashboard/admin-invites";
import type { Role } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-2xl border border-input bg-background/75 px-4 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

type CreatedInvite = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  token: string;
  code: string;
  inviteUrl: string;
};

function statusVariant(status: string) {
  if (status === "pending") return "info";
  if (status === "accepted" || status === "used") return "success";
  if (status === "revoked") return "danger";
  return "warning";
}

async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied.`);
}

export function InviteManagement({ data }: { data: AdminInvitesData }) {
  const router = useRouter();
  const [createdInvites, setCreatedInvites] = useState<CreatedInvite[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    emails: "",
    role: "student" as "student" | "teacher" | "admin",
    expiresInDays: "7",
    department: "",
    classId: "",
    section: "",
    maxUses: "1",
    personalMessage: "",
  });

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createInvites(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);

    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: form.emails,
          role: form.role,
          expiresInDays: Number(form.expiresInDays),
          department: form.department || null,
          classId: form.classId || null,
          section: form.section || null,
          maxUses: Number(form.maxUses),
          personalMessage: form.personalMessage || null,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        invites?: CreatedInvite[];
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Unable to create invite.");
      }

      setCreatedInvites(result.invites ?? []);
      setForm((current) => ({ ...current, emails: "", personalMessage: "" }));
      toast.success("Invite created.", {
        description: "Copy the link or code now. Raw secrets are shown once.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Invite failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(id: string) {
    try {
      const response = await fetch(`/api/admin/invites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to revoke invite.");
      }

      toast.success("Invite revoked.");
      router.refresh();
    } catch (error) {
      toast.error("Revoke failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {data.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{metric.meta}</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-semibold">{metric.value}</p>
                <Badge>{metric.label}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {createdInvites.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="size-5 text-primary" />
              Invite secrets shown once
            </CardTitle>
            <CardDescription>
              Copy these links or codes before leaving this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {createdInvites.map((invite) => (
              <div
                key={invite.id}
                className="rounded-3xl border border-border bg-background/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold">{invite.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {invite.role} invite expires{" "}
                      {formatDate(invite.expiresAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyText(invite.inviteUrl, "Invite link")}
                    >
                      <Link2 /> Link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyText(invite.code, "Invite code")}
                    >
                      <Clipboard /> {invite.code}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailPlus className="size-5 text-primary" />
              Invite builder
            </CardTitle>
            <CardDescription>
              Create single or bulk invite links with role, class, section, and
              expiry controls.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createInvites}>
              <Textarea
                required
                value={form.emails}
                onChange={(event) => updateField("emails", event.target.value)}
                placeholder="student@example.com, teacher@example.com"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className={selectClass}
                  value={form.role}
                  onChange={(event) => updateField("role", event.target.value)}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Staff admin</option>
                </select>
                <Input
                  min={1}
                  max={90}
                  type="number"
                  value={form.expiresInDays}
                  onChange={(event) =>
                    updateField("expiresInDays", event.target.value)
                  }
                  placeholder="Expires in days"
                />
                <Input
                  value={form.department}
                  onChange={(event) =>
                    updateField("department", event.target.value)
                  }
                  placeholder="Department"
                />
                <Input
                  value={form.section}
                  onChange={(event) =>
                    updateField("section", event.target.value)
                  }
                  placeholder="Section"
                />
                <select
                  className={cn(selectClass, "sm:col-span-2")}
                  value={form.classId}
                  onChange={(event) =>
                    updateField("classId", event.target.value)
                  }
                >
                  <option value="">No class assignment</option>
                  {data.classes.map((classRecord) => (
                    <option key={classRecord.id} value={classRecord.id}>
                      {classRecord.name}
                      {classRecord.section ? ` - ${classRecord.section}` : ""}
                    </option>
                  ))}
                </select>
                <Input
                  min={1}
                  max={500}
                  type="number"
                  value={form.maxUses}
                  onChange={(event) =>
                    updateField("maxUses", event.target.value)
                  }
                  placeholder="Max uses"
                />
              </div>
              <Textarea
                value={form.personalMessage}
                onChange={(event) =>
                  updateField("personalMessage", event.target.value)
                }
                placeholder="Optional personal message"
              />
              <Button className="w-full" disabled={busy} variant="premium">
                <MailPlus /> {busy ? "Creating..." : "Create invite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite tracking</CardTitle>
            <CardDescription>
              Pending, accepted, expired, and revoked invites from real records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.invites.length === 0 && (
              <EmptyState
                variant="messages"
                message="No invite records yet. Create an invite to start onboarding users."
              />
            )}
            {data.invites.map((invite) => (
              <div
                key={invite.id}
                className="rounded-3xl border border-border bg-background/60 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{invite.email}</p>
                      <Badge variant={statusVariant(invite.status)}>
                        {invite.status}
                      </Badge>
                      <Badge variant="secondary">{invite.role}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {invite.className ?? invite.department ?? "Institution"}{" "}
                      {invite.section ? `- ${invite.section}` : ""} - expires{" "}
                      {formatDate(invite.expiresAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uses: {invite.usedCount}/{invite.maxUses}
                    </p>
                  </div>
                  {invite.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revokeInvite(invite.id)}
                    >
                      <ShieldOff /> Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
