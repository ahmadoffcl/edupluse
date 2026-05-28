import Link from "next/link";
import { ShieldCheck, UserPlus } from "lucide-react";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
import { EmptyState } from "@/components/dashboard/content-blocks";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminUsers } from "@/lib/dashboard/admin-users";

function formatDateTime(value: string | null) {
  if (!value) return "Not seen yet";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminUsersPage() {
  const users = await getAdminUsers();
  const students = users.filter((user) => user.role === "student").length;
  const teachers = users.filter((user) => user.role === "teacher").length;
  const admins = users.filter(
    (user) => user.role === "admin" || user.role === "super_admin",
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow="User management"
        title="Manage every real account that joins your institution."
        description="Review registered users, roles, account status, usernames, and access actions from one admin surface."
        action={
          <Button asChild variant="premium">
            <Link href="/admin/invites">
              <UserPlus /> Invite user
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          ["Students", students, "Self-registered and invited learners"],
          ["Teachers", teachers, "Educator accounts"],
          ["Admins", admins, "Privileged operators"],
        ].map(([label, value, meta]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{meta}</p>
              <div className="mt-3 flex items-end justify-between">
                <h2 className="text-3xl font-semibold">{value}</h2>
                <Badge>{label}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Registered users
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.length === 0 && (
            <EmptyState
              variant="messages"
              message="No registered users yet. When students or teachers create accounts, they will appear here with role and access actions."
            />
          )}

          {users.map((user) => (
            <div
              key={`${user.id}-${user.role}`}
              className="rounded-3xl border border-border bg-background/60 p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{user.displayName}</p>
                    <Badge variant="secondary" className="capitalize">
                      {user.role.replace("_", " ")}
                    </Badge>
                    <Badge
                      variant={user.status === "active" ? "success" : "warning"}
                    >
                      {user.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {user.username ? `@${user.username}` : "Username not set"} -
                    {` ${user.email}`}
                  </p>
                  {user.phone && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Phone: {user.phone}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last active: {formatDateTime(user.lastSeenAt)}
                  </p>
                </div>

                <AdminUserActions
                  membershipId={user.id}
                  email={user.email}
                  role={user.role}
                  status={user.status}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
