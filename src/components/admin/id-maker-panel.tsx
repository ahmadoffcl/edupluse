"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardPaste,
  GraduationCap,
  Loader2,
  UserPlus,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import {
  UsernameAvailabilityNote,
  useUsernameAvailability,
} from "@/components/profile/username-availability";
import { cn } from "@/lib/utils";

type MakerRole = "student" | "teacher";
type AccountForm = {
  displayName: string;
  email: string;
  username: string;
  phone: string;
  password: string;
};
type IdMakerResult = {
  ok: boolean;
  email: string;
  displayName: string;
  role: MakerRole;
  status: "created" | "linked" | "failed";
  message: string;
};

const emptyForm: AccountForm = {
  displayName: "",
  email: "",
  username: "",
  phone: "",
  password: "",
};

function parseBulkRows(text: string, role: MakerRole) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(/,|\t|;/)
        .map((part) => part.trim())
        .filter(Boolean);

      return {
        role,
        displayName: parts[0] ?? "",
        email: parts[1] ?? "",
        phone: parts[2] ?? "",
        password: parts[3] ?? "",
        username: parts[4] ?? "",
      };
    });
}

function resultTone(result: IdMakerResult) {
  if (result.ok && result.status === "created") return "success";
  if (result.ok) return "secondary";
  return "danger";
}

function RoleMakerSection({
  role,
  title,
  subtitle,
}: {
  role: MakerRole;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState<"single" | "bulk" | null>(null);
  const [results, setResults] = useState<IdMakerResult[]>([]);
  const Icon = role === "teacher" ? GraduationCap : UsersRound;
  const usernameCheck = useUsernameAvailability(form.username, "new");
  const usernameBlocked =
    !usernameCheck.isAvailable || usernameCheck.isChecking;
  const accent =
    role === "teacher"
      ? "from-sky-500/18 via-primary/10 to-transparent"
      : "from-emerald-500/18 via-primary/10 to-transparent";
  const resultSummary = useMemo(() => {
    const success = results.filter((result) => result.ok).length;
    const failed = results.length - success;
    return { success, failed };
  }, [results]);

  function setField(field: keyof AccountForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createAccounts(
    users: Array<AccountForm & { role: MakerRole }>,
    mode: "single" | "bulk",
  ) {
    if (users.length === 0) {
      toast.error("No accounts found");
      return;
    }

    if (mode === "single" && usernameBlocked) {
      toast.error("Choose an available username first.");
      return;
    }

    setBusy(mode);

    try {
      const response = await fetch("/api/admin/id-maker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ users }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        results?: IdMakerResult[];
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to create accounts.");
      }

      const nextResults = data?.results ?? [];
      setResults(nextResults);
      const ready = nextResults.filter((result) => result.ok).length;
      const failed = nextResults.length - ready;

      if (ready > 0) {
        toast.success(
          `${ready} ${role} account${ready === 1 ? "" : "s"} ready`,
          {
            description:
              failed > 0
                ? `${failed} row${failed === 1 ? "" : "s"} failed.`
                : undefined,
          },
        );
        setForm(emptyForm);
        if (mode === "bulk") setBulkText("");
        router.push("/admin/users");
      } else {
        toast.error("No accounts were created", {
          description:
            nextResults[0]?.message ?? "Check the details and retry.",
        });
      }
    } catch (error) {
      toast.error("ID Maker failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-24 bg-gradient-to-r", accent)} />
      <CardHeader className="-mt-12">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-border bg-background shadow-lg">
          <Icon className="size-6 text-primary" />
        </div>
        <CardTitle className="flex flex-wrap items-center gap-3">
          {title}
          <Badge variant="secondary" className="capitalize">
            {role}
          </Badge>
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void createAccounts([{ ...form, role }], "single");
          }}
        >
          <Input
            required
            placeholder="Full name"
            value={form.displayName}
            onChange={(event) => setField("displayName", event.target.value)}
          />
          <label className="space-y-1.5">
            <Input
              required
              placeholder="@username"
              value={form.username}
              onChange={(event) => setField("username", event.target.value)}
            />
            <UsernameAvailabilityNote
              status={usernameCheck.status}
              message={usernameCheck.message}
            />
          </label>
          <Input
            required
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(event) => setField("email", event.target.value)}
          />
          <Input
            placeholder="Phone number"
            value={form.phone}
            onChange={(event) => setField("phone", event.target.value)}
          />
          <Input
            required
            minLength={6}
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => setField("password", event.target.value)}
          />
          <Button
            className="md:col-span-2"
            disabled={busy !== null || usernameBlocked}
            type="submit"
            variant="premium"
          >
            {busy === "single" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <UserPlus />
            )}
            Save {role} login
          </Button>
        </form>

        <div className="rounded-3xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Bulk creator</p>
              <p className="text-xs text-muted-foreground">
                One row: name, email, phone, password, username
              </p>
            </div>
            <Badge variant="secondary">
              <ClipboardPaste className="size-3" />
              CSV paste
            </Badge>
          </div>
          <Textarea
            className="min-h-36"
            placeholder={`Ahmed Malik, ahmed@example.com, 03001234567, pass1234, ahmed_bscs\nZara Khan, zara@example.com, 03007654321, pass5678, zara.dev`}
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
          />
          <Button
            className="mt-3 w-full"
            disabled={busy !== null}
            type="button"
            variant="outline"
            onClick={() => {
              void createAccounts(parseBulkRows(bulkText, role), "bulk");
            }}
          >
            {busy === "bulk" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ClipboardPaste />
            )}
            Create bulk {role} IDs
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{resultSummary.success} ready</Badge>
              {resultSummary.failed > 0 && (
                <Badge variant="danger">{resultSummary.failed} failed</Badge>
              )}
            </div>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {results.map((result) => (
                <div
                  key={`${result.email}-${result.status}`}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-3"
                >
                  {result.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {result.displayName}
                      </p>
                      <Badge variant={resultTone(result)}>
                        {result.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {result.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function IdMakerPanel() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <RoleMakerSection
        role="teacher"
        title="Teacher ID Maker"
        subtitle="Create educator logins that open directly into the teacher dashboard."
      />
      <RoleMakerSection
        role="student"
        title="Student ID Maker"
        subtitle="Prepare login IDs for classmates with dashboard access ready on first sign-in."
      />
    </div>
  );
}
