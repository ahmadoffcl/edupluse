"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";

type IntroState = "checking" | "typing" | "holding" | "fading" | "hidden";

const introStorageKey = "edupulse.welcome.seen";
const introText = "Welcome to your EduPulse workspace";

export function WelcomeIntro() {
  const pathname = usePathname();
  const [state, setState] = useState<IntroState>("checking");
  const [typedText, setTypedText] = useState("");
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/reset-password";

  useEffect(() => {
    if (isAuthPage) return;

    const alreadySeen = window.sessionStorage.getItem(introStorageKey);
    if (alreadySeen === "true") return;

    const frame = window.requestAnimationFrame(() => setState("typing"));
    return () => window.cancelAnimationFrame(frame);
  }, [isAuthPage]);

  useEffect(() => {
    if (state !== "typing") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const writeTimeout = window.setTimeout(() => setTypedText(introText), 0);
      const fadeTimeout = window.setTimeout(() => setState("fading"), 720);
      return () => {
        window.clearTimeout(writeTimeout);
        window.clearTimeout(fadeTimeout);
      };
    }

    let index = 0;
    let holdTimeout: number | undefined;
    const interval = window.setInterval(() => {
      index += 1;
      setTypedText(introText.slice(0, index));

      if (index >= introText.length) {
        window.clearInterval(interval);
        holdTimeout = window.setTimeout(() => setState("holding"), 550);
      }
    }, 44);

    return () => {
      window.clearInterval(interval);
      if (holdTimeout) window.clearTimeout(holdTimeout);
    };
  }, [state]);

  useEffect(() => {
    if (state !== "holding") return;

    const timeout = window.setTimeout(() => setState("fading"), 720);
    return () => window.clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    if (state !== "fading") return;

    const timeout = window.setTimeout(() => {
      window.sessionStorage.setItem(introStorageKey, "true");
      setState("hidden");
    }, 520);

    return () => window.clearTimeout(timeout);
  }, [state]);

  if (isAuthPage || state === "checking" || state === "hidden") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] grid min-h-dvh place-items-center overflow-hidden bg-background px-5 text-foreground transition-opacity duration-500 ${
        state === "fading" ? "opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
      aria-busy={state !== "fading"}
    >
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-80" />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <BrandLogo
          className="mb-8"
          markClassName="size-16 rounded-[1.35rem] md:size-20"
          textClassName="text-2xl md:text-3xl"
        />
        <p className="min-h-[3.5rem] max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:min-h-[5rem] sm:text-6xl">
          {typedText}
          <span className="type-caret ml-1 inline-block h-[0.9em] w-1 translate-y-1 rounded-full bg-primary align-baseline" />
        </p>
        <div className="mt-8 grid w-full max-w-lg grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground sm:text-sm">
          {["Learning", "Analytics", "AI support"].map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-card/70 px-3 py-2"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
