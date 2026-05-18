"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Globe2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { homeForRole } from "@/lib/permissions";
import type { AuthSessionResult } from "@/lib/types";

function authErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Please check your details.";

  if (
    message.includes("api-key-not-valid") ||
    message.includes("API key not valid")
  ) {
    return "Sign-in is temporarily unavailable. Please contact support.";
  }

  if (message.includes("Firebase Admin credentials")) {
    return "Your identity was verified, but workspace access is not ready yet.";
  }

  if (message.includes("Workspace access is not configured")) {
    return "Workspace access is not ready yet. Please contact support.";
  }

  if (message.includes("Workspace setup is not complete")) {
    return "Workspace setup is not complete yet. Please contact support.";
  }

  if (message.includes("No active EduPulse profile")) {
    return "This account is not part of an institute yet. Please ask your admin for access.";
  }

  return message;
}

export function AuthPanel({ mode }: { mode: "login" | "signup" | "reset" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    configured,
    loginWithDemo,
    loginWithEmail,
    loginWithGoogle,
    resetPassword,
    signUpWithEmail,
  } = useAuth();
  const demoMode = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";

  const title = useMemo(() => {
    if (mode === "signup") return "Create your EduPulse account";
    if (mode === "reset") return "Reset your password";
    return "Welcome back to EduPulse";
  }, [mode]);

  async function finish(result: AuthSessionResult) {
    if (next && result.onboardingCompleted) {
      router.push(next);
      return;
    }

    if (result.onboardingCompleted) {
      router.push(homeForRole(result.role));
      return;
    }

    if (result.role === "student") {
      router.push("/onboarding/student");
      return;
    }

    if (result.role === "teacher") {
      router.push("/onboarding/teacher");
      return;
    }

    router.push(homeForRole(result.role));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);

    try {
      if (mode === "reset") {
        await resetPassword(email);
        router.push("/login");
        return;
      }

      if (mode === "signup") {
        const resolvedRole = await signUpWithEmail(
          email,
          password,
          displayName || "EduPulse user",
        );
        await finish(resolvedRole);
      } else {
        const resolvedRole = await loginWithEmail(email, password);
        await finish(resolvedRole);
      }
    } catch (error) {
      toast.error("Sign-in failed", {
        description: authErrorMessage(error),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PublicNavbar />
      <main className="grid min-h-screen px-4 pb-12 pt-28 lg:grid-cols-[1fr_520px]">
        <section className="mx-auto hidden max-w-3xl flex-col justify-center lg:flex">
          <Badge className="mb-4">
            <ShieldCheck className="size-3" />
            Secure role-based onboarding
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight">
            One beautiful workspace for every learner, teacher, and institute
            admin.
          </h1>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {["Secure access", "Role dashboards", "Daily learning hub"].map(
              (item) => (
                <Card key={item}>
                  <CardContent className="p-5 text-sm font-semibold">
                    {item}
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-xl items-center">
          <Card className="w-full">
            <CardContent className="p-6 md:p-8">
              <div className="mb-8 flex items-center gap-3">
                <BrandLogo showText={false} markClassName="size-12" />
                <div>
                  <p className="text-sm text-muted-foreground">EduPulse</p>
                  <h2 className="text-2xl font-semibold">{title}</h2>
                </div>
              </div>

              <form
                action="/api/auth/admin-session"
                className="space-y-4"
                method="post"
                onSubmit={onSubmit}
              >
                <input
                  type="hidden"
                  name="deviceSessionId"
                  value="form-session"
                />
                {mode === "signup" && (
                  <Input
                    name="displayName"
                    placeholder="Full name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                )}
                <Input
                  name="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                {mode !== "reset" && (
                  <Input
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                )}
                <Button
                  className="w-full"
                  variant="premium"
                  type="submit"
                  disabled={busy}
                >
                  {mode === "reset"
                    ? "Send reset email"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"}
                  <ArrowRight />
                </Button>
              </form>

              {mode !== "reset" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        setBusy(true);
                        const resolvedRole = await loginWithGoogle();
                        await finish(resolvedRole);
                      } catch (error) {
                        toast.error("Google sign-in failed", {
                          description: authErrorMessage(error),
                        });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Globe2 /> Google
                  </Button>
                  {demoMode && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          setBusy(true);
                          const result = await loginWithDemo("student");
                          await finish(result);
                        } catch (error) {
                          toast.error("Demo session failed", {
                            description:
                              error instanceof Error
                                ? error.message
                                : "Try again.",
                          });
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Demo access
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-6 space-y-2 text-sm text-muted-foreground">
                {!configured && (
                  <p className="rounded-2xl bg-amber-400/10 p-3 text-amber-700 dark:text-amber-300">
                    Email and social sign-in are not available right now.
                  </p>
                )}
                {mode === "login" && (
                  <>
                    <Link
                      href="/reset-password"
                      className="block hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                    <Link
                      href="/signup"
                      className="block hover:text-foreground"
                    >
                      Need an account?
                    </Link>
                  </>
                )}
                {mode === "signup" && (
                  <Link href="/login" className="block hover:text-foreground">
                    Already have an account?
                  </Link>
                )}
                {mode === "reset" && (
                  <Link href="/login" className="block hover:text-foreground">
                    Back to login
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
