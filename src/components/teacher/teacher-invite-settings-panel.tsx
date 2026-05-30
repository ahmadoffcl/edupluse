"use client";

import { useState, type FormEvent } from "react";
import { Clipboard, MailPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { TeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

type CreatedInvite = {
  inviteUrl: string;
  code: string;
  emailed: number;
};

export function TeacherInviteSettingsPanel({
  data,
}: {
  data: TeacherWorkflowData;
}) {
  const [busy, setBusy] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(
    null,
  );

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setCreatedInvite(null);
    try {
      const emails = String(form.get("emails") ?? "")
        .split(/[\n,]+/)
        .map((email) => email.trim())
        .filter(Boolean);
      const response = await fetch("/api/teacher/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: String(form.get("classId") ?? ""),
          role: String(form.get("role") ?? "student"),
          emails,
          expiresInDays: Number(form.get("expiresInDays") ?? 7),
          maxUses: Number(form.get("maxUses") ?? 30),
          personalMessage: String(form.get("personalMessage") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        invite?: { inviteUrl: string; code: string };
        emailed?: number;
        error?: string;
      } | null;

      if (!response.ok || payload?.ok === false || !payload?.invite) {
        throw new Error(payload?.error ?? "Unable to create invite.");
      }

      setCreatedInvite({
        inviteUrl: payload.invite.inviteUrl,
        code: payload.invite.code,
        emailed: payload.emailed ?? 0,
      });
      toast.success("Invite ready", {
        description: payload.emailed
          ? `Email sent to ${payload.emailed} recipient${payload.emailed === 1 ? "" : "s"}.`
          : "Copy the link or class code to share it.",
      });
      event.currentTarget.reset();
    } catch (error) {
      toast.error("Invite failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersRound className="size-5 text-primary" />
          Invite students or teachers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.classes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
            Create a class first, then invites can be generated here.
          </div>
        ) : (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createInvite}>
            <select
              name="classId"
              required
              className="h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              defaultValue={data.classes[0]?.id}
            >
              {data.classes.map((classRecord) => (
                <option key={classRecord.id} value={classRecord.id}>
                  {classRecord.name}
                </option>
              ))}
            </select>
            <select
              name="role"
              className="h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              defaultValue="student"
            >
              <option value="student">Invite students</option>
              <option value="teacher">Invite teacher</option>
            </select>
            <Input
              name="expiresInDays"
              type="number"
              min={1}
              max={60}
              defaultValue={7}
              placeholder="Expiry days"
            />
            <Input
              name="maxUses"
              type="number"
              min={1}
              max={200}
              defaultValue={30}
              placeholder="Usage limit"
            />
            <Textarea
              name="emails"
              className="md:col-span-2"
              placeholder="Email addresses, one per line or comma-separated"
            />
            <Textarea
              name="personalMessage"
              className="md:col-span-2"
              placeholder="Optional note for the invite email"
            />
            <Button className="md:col-span-2" disabled={busy}>
              <MailPlus />
              {busy ? "Sending..." : "Create invite and send email"}
            </Button>
          </form>
        )}

        {createdInvite ? (
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Invite created</p>
              <Badge variant="success">
                {createdInvite.emailed} email
                {createdInvite.emailed === 1 ? "" : "s"} sent
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(createdInvite.inviteUrl, "Invite link")}
              >
                <Clipboard /> Copy link
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(createdInvite.code, "Class code")}
              >
                <Clipboard /> {createdInvite.code}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
