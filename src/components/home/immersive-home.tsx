"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  BrainCircuit,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const story = [
  "A student opens class and sees exactly what matters next.",
  "A teacher posts work, shares a file, and reviews submissions from the same room.",
  "An admin creates users and keeps every role connected to the right institution.",
];

const principles = [
  {
    icon: ShieldCheck,
    title: "Role-safe by design",
    text: "Students, teachers, and admins see only the spaces and actions they are allowed to use.",
  },
  {
    icon: MessageSquareText,
    title: "Classroom social layer",
    text: "Posts, messages, files, and submissions feel connected like a modern learning community.",
  },
  {
    icon: BrainCircuit,
    title: "AI-ready foundation",
    text: "Study help, summaries, quiz drafts, and insights can sit beside real classroom work.",
  },
];

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("home-fade-in", className)}
      style={{ "--home-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function ImmersiveHome() {
  return (
    <>
      <PublicNavbar />
      <main className="overflow-hidden bg-background">
        <section className="relative px-4 pb-14 pt-24 sm:pt-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(45,212,191,0.14),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(99,102,241,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_42%)]" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
          <div className="mx-auto max-w-7xl">
            <div className="home-hero-frame relative min-h-[620px] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_45px_140px_-80px_rgba(91,124,255,0.9)] sm:min-h-[640px] sm:rounded-[2.5rem] lg:min-h-[690px]">
              <div className="absolute inset-x-0 top-0 h-[52%] sm:inset-0 sm:h-auto">
                <Image
                  src="/edupulse-hero.jpg"
                  alt="EduPulse digital classroom ecosystem"
                  fill
                  priority
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  className="home-hero-art object-cover object-[68%_center] sm:object-center"
                />
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.22)_36%,#000_58%,#000_100%)] sm:bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.96)_22%,rgba(0,0,0,0.62)_48%,rgba(0,0,0,0.12)_78%)]" />
              <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black to-transparent" />
              <div className="absolute left-8 top-8 hidden h-24 w-24 rounded-full bg-primary/20 blur-3xl sm:block" />
              <div className="relative z-10 grid min-h-[620px] items-end px-5 pb-10 pt-72 sm:min-h-[640px] sm:items-center sm:px-9 sm:py-8 lg:min-h-[690px] lg:grid-cols-[0.82fr_1.18fr] lg:px-12">
                <FadeIn className="max-w-xl">
                  <Badge className="mb-5 border-white/10 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
                    <Sparkles className="size-3" />
                    Learn. Teach. Grow.
                  </Badge>
                  <h1 className="text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Classrooms that feel alive.
                  </h1>
                  <p className="mt-5 max-w-lg text-base leading-7 text-white/72 sm:text-lg">
                    EduPulse turns classes, assignments, notes, messages, and
                    progress into one calm daily learning space.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Button asChild size="lg" variant="premium">
                      <Link href="/login">
                        Open EduPulse <ArrowRight />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Link href="/features">Explore features</Link>
                    </Button>
                  </div>
                </FadeIn>
                <div className="hidden lg:block" aria-hidden="true" />
              </div>
              <div className="home-scroll-cue absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white/70 backdrop-blur-xl sm:flex">
                <span className="size-1.5 rounded-full bg-cyan-200" />
                Scroll to explore
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto max-w-7xl">
            <FadeIn className="mx-auto max-w-3xl text-center">
              <Badge className="mb-3">Classroom flow</Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                Built around the way classes actually move.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Not a maze of modules. One stream for class energy, one place
                for work, one library for files, and one roster for people.
              </p>
            </FadeIn>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {story.map((item, index) => (
                <FadeIn key={item} delay={index * 0.08}>
                  <Card className="h-full">
                    <CardContent className="p-5">
                      <div className="mb-5 flex items-center justify-between">
                        <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                          {index + 1}
                        </span>
                        <ArrowRight className="size-5 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold leading-7">{item}</p>
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <FadeIn>
              <Badge className="mb-3">Experience</Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                Premium enough to inspire, simple enough to use daily.
              </h2>
              <p className="mt-4 text-muted-foreground">
                EduPulse keeps the emotional side of learning visible: progress,
                feedback, classmates, files, and the next best action.
              </p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="grid gap-4 sm:grid-cols-3">
                {principles.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.title} className="h-full">
                      <CardContent className="p-5">
                        <Icon className="mb-5 size-6 text-primary" />
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {item.text}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="px-4 pb-20 pt-10">
          <div className="mx-auto overflow-hidden rounded-[2rem] border border-border bg-[linear-gradient(135deg,rgba(45,212,191,0.16),rgba(99,102,241,0.14),rgba(255,255,255,0.04))] p-6 text-center shadow-[var(--shadow-soft)] sm:p-10">
            <BrandLogo showText={false} markClassName="mx-auto size-14" />
            <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Make every class easier to open, understand, and finish.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Start with one classroom. Grow into a full institute workspace.
            </p>
            <div className="mt-7 flex justify-center">
              <Button asChild size="lg">
                <Link href="/login">
                  Enter workspace <LockKeyhole />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
