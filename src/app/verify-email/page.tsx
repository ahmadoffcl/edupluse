import Link from "next/link";
import { MailCheck } from "lucide-react";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <>
      <PublicNavbar />
      <main className="grid min-h-screen place-items-center px-4 pt-20">
        <Card className="max-w-lg text-center">
          <CardContent className="p-8">
            <div className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-primary/12 text-primary">
              <MailCheck className="size-8" />
            </div>
            <h1 className="text-3xl font-semibold">Check your email</h1>
            <p className="mt-3 text-muted-foreground">
              Once your email is verified, your institute role decides your
              dashboard access.
            </p>
            <Button asChild className="mt-6" variant="premium">
              <Link href="/login">Back to login</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
