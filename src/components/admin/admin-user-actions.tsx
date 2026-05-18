"use client";

import { useRouter } from "next/navigation";
import { Ban, Mail, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";

export function AdminUserActions({
  membershipId,
  email,
  role,
  status,
}: {
  membershipId: string;
  email: string;
  role: Role;
  status: string;
}) {
  const router = useRouter();

  async function updateUser(body: { role?: Role; status?: string }) {
    const response = await fetch(`/api/admin/users/${membershipId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "Unable to update user.");
    }

    router.refresh();
  }

  async function runAction(
    label: string,
    body: { role?: Role; status?: string },
  ) {
    try {
      await updateUser(body);
      toast.success(label);
    } catch (error) {
      toast.error("User action failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={`mailto:${email}`}>
          <Mail /> Message
        </a>
      </Button>
      {role !== "student" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            runAction("User role changed to student.", { role: "student" })
          }
        >
          <UserCog /> Student
        </Button>
      )}
      {role !== "teacher" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            runAction("User role changed to teacher.", { role: "teacher" })
          }
        >
          <UserCog /> Teacher
        </Button>
      )}
      {role !== "admin" && role !== "super_admin" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            runAction("User role changed to admin.", { role: "admin" })
          }
        >
          <ShieldCheck /> Admin
        </Button>
      )}
      {status === "suspended" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => runAction("User reactivated.", { status: "active" })}
        >
          <ShieldCheck /> Activate
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => runAction("User suspended.", { status: "suspended" })}
        >
          <Ban /> Suspend
        </Button>
      )}
    </div>
  );
}
