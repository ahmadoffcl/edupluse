import { Link2, MailPlus, ShieldCheck, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const inviteOptions = [
  {
    title: "Email invites",
    text: "Send verified links with expiration, role, department, class, and personal message.",
    icon: MailPlus,
  },
  {
    title: "Invite links",
    text: "Create controlled links for departments, classes, staff, or short onboarding windows.",
    icon: Link2,
  },
  {
    title: "Invite codes",
    text: "Generate classroom-safe codes for students joining in person or during live sessions.",
    icon: ShieldCheck,
  },
];

export default function AdminInvitesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Onboarding control"
        title="Invite students, teachers, and staff into the right institution workflow."
        description="Create secure invites with roles, expiration windows, departments, classes, temporary permissions, and optional personal messages."
        action={<Button variant="premium">Create invite</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {inviteOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Card key={option.title}>
              <CardContent className="p-5">
                <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
                  <Icon className="size-5" />
                </div>
                <h2 className="font-semibold">{option.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {option.text}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Invite builder</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Email or comma-separated emails" />
            <Input placeholder="Role: student, teacher, staff" />
            <Input placeholder="Institution" />
            <Input placeholder="Department or class" />
            <Input placeholder="Expiration window" />
            <Input placeholder="Optional message" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent">
              <UsersRound className="size-5" />
            </div>
            <h2 className="font-semibold">No pending invites yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Pending, expired, accepted, and revoked invites will appear here
              once real invite records exist.
            </p>
            <Button className="mt-5 w-full" variant="outline">
              Import bulk list
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
