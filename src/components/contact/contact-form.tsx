"use client";

import { type FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          institute: String(form.get("institute") ?? ""),
          subject: String(form.get("subject") ?? ""),
          message: String(form.get("message") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? "Unable to send message.");
      }

      event.currentTarget.reset();
      setSent(true);
      toast.success("Message sent to admin.");
    } catch (error) {
      toast.error("Message could not be sent", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden border-white/18 bg-white/82 shadow-[0_32px_120px_-54px_rgba(40,80,180,0.75)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
      <CardContent className="p-4 sm:p-6">
        {sent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-5"
          >
            <div className="grid size-12 place-items-center rounded-full bg-emerald-400/15 text-emerald-500">
              <Sparkles className="size-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Request received</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your message is now in the admin contact inbox. The team can
              review and reply from their dashboard.
            </p>
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => setSent(false)}
            >
              Send another
            </Button>
          </motion.div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold">Name</span>
                <Input name="name" placeholder="Your name" required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Email</span>
                <Input
                  name="email"
                  placeholder="you@example.com"
                  required
                  type="email"
                />
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Institute</span>
              <Input
                name="institute"
                placeholder="School, academy, coaching center"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Subject</span>
              <Input name="subject" placeholder="What do you need help with?" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Message</span>
              <Textarea
                name="message"
                placeholder="Tell the admin what happened or what you need."
                required
                className="min-h-36"
              />
            </label>
            <Button
              className="h-12 w-full rounded-2xl"
              disabled={busy}
              variant="premium"
            >
              {busy ? <Mail /> : <Send />}
              {busy ? "Sending..." : "Send request"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
