import Link from "next/link";
import { Clock, KeyRound, ShieldCheck } from "lucide-react";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function InviteAcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hasToken = token.trim().length >= 12;

  return (
    <>
      <PublicNavbar />
      <main className="grid min-h-screen place-items-center px-4 pt-24">
        <Card className="w-full max-w-2xl overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <Badge className="mb-5">
              <ShieldCheck className="size-3" />
              Secure invitation
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              {hasToken ? "Complete your invite" : "Invite link unavailable"}
            </h1>
            <p className="mt-4 leading-7 text-muted-foreground">
              EduPulse checks invite status, role, expiration, institution, and
              assigned class access before creating a workspace account.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                ["Token validation", hasToken ? "Ready" : "Missing"],
                ["Expiration", "Checked server-side"],
                ["Role access", "Assigned by admin"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-dashed border-border bg-muted/50 p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                  {hasToken ? <KeyRound /> : <Clock />}
                </div>
                <div>
                  <p className="font-semibold">
                    {hasToken
                      ? "Create your password to continue"
                      : "Ask your admin for a fresh invite"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Institution branding, invited role, class assignment, and a
                    personal message appear here once a real invite record is
                    connected.
                  </p>
                </div>
              </div>
            </div>

            <Button asChild className="mt-6" variant="premium">
              <Link href="/signup">Continue</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
