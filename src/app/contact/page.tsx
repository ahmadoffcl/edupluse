import { PublicNavbar } from "@/components/layout/public-navbar";
import { ContactForm } from "@/components/contact/contact-form";
import { Badge } from "@/components/ui/badge";

export default function ContactPage() {
  return (
    <>
      <PublicNavbar />
      <main className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-8 px-4 pb-20 pt-32 lg:grid-cols-[0.8fr_1fr]">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_18%_24%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_76%_16%,rgba(124,156,255,0.18),transparent_30%)]" />
        <div>
          <Badge className="mb-4">Support</Badge>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
            Send a message straight to your admin.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            Ask for help, request onboarding support, report a class issue, or
            contact the institute team. Admins can review and reply from their
            dashboard.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Admin inbox", "Reply tracking", "Secure record"].map((item) => (
              <div
                key={item}
                className="rounded-full border border-border bg-card/70 px-4 py-3 text-center text-sm font-semibold shadow-sm backdrop-blur"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <ContactForm />
      </main>
    </>
  );
}
