import { PublicNavbar } from "@/components/layout/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

export default function ContactPage() {
  return (
    <>
      <PublicNavbar />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 pt-32 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <Badge className="mb-4">Support</Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Talk to the EduPulse team.
          </h1>
          <p className="mt-5 text-muted-foreground">
            Use this production-ready contact surface for sales, support, and
            onboarding requests.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-4 p-6">
            <Input placeholder="Name" />
            <Input placeholder="Work email" type="email" />
            <Input placeholder="Institute or academy" />
            <Textarea placeholder="What would you like to build with EduPulse?" />
            <Button className="w-full" variant="premium">
              Send request
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
