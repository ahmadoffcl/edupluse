"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasCompletedOnboarding } from "@/lib/onboarding-storage";
import { canAccessPath, homeForRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { AuthSessionResult, AuthUser } from "@/lib/types";

type AuthMode = "login" | "signup";
type AuthPanelMode = AuthMode | "reset";

const authCopy = {
  login: {
    title: "Sign In",
    submit: "Login",
    switchAction: "SignUp",
  },
  signup: {
    title: "Sign Up",
    submit: "Create Account",
    switchAction: "SignIn",
  },
  reset: {
    title: "Reset Password",
    submit: "Send Reset Link",
    switchAction: "SignIn",
  },
} satisfies Record<
  AuthPanelMode,
  {
    title: string;
    submit: string;
    switchAction: string;
  }
>;

function authErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Please check your details.";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("auth/weak-password") ||
    normalized.includes("password should be") ||
    normalized.includes("invalid-password")
  ) {
    return "Use a stronger password with at least 8 characters.";
  }

  if (
    normalized.includes("auth/invalid-credential") ||
    normalized.includes("auth/wrong-password") ||
    normalized.includes("auth/user-not-found") ||
    normalized.includes("invalid login credentials")
  ) {
    return "The email or password is incorrect.";
  }

  if (normalized.includes("auth/email-already-in-use")) {
    return "An account already exists with this email. Sign in instead.";
  }

  if (normalized.includes("auth/invalid-email")) {
    return "Enter a valid email address.";
  }

  if (normalized.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait a bit and try again.";
  }

  if (
    message.includes("api-key-not-valid") ||
    message.includes("API key not valid")
  ) {
    return "Sign-in is temporarily unavailable. Please contact support.";
  }

  if (message.includes("Firebase Admin credentials")) {
    return "Your identity was verified, but workspace access is not ready yet.";
  }

  if (message.includes("aborted") || message.includes("timed out")) {
    return "The workspace took too long to respond. Please try again.";
  }

  if (message.includes("Workspace access is not configured")) {
    return "Your account can continue setup now. If this repeats, sign out and try again.";
  }

  if (message.includes("Workspace setup is not complete")) {
    return "Your account can continue setup now. If this repeats, sign out and try again.";
  }

  if (message.includes("No active EduPulse profile")) {
    return "This account can be set up now. Please create your profile to continue.";
  }

  return message
    .replaceAll("Firebase: ", "")
    .replaceAll("FirebaseError: ", "")
    .replace(/\s*\(auth\/[^)]+\)\.?/gi, "")
    .trim();
}

function AuthBackdrop() {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 -z-30 bg-[#060914]" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_20%_18%,rgba(34,211,238,0.2),transparent_30%),radial-gradient(circle_at_78%_42%,rgba(124,156,255,0.18),transparent_28%),radial-gradient(circle_at_92%_76%,rgba(168,85,247,0.18),transparent_34%)]"
      />
    </>
  );
}

function AuthVisual({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.aside
      className="relative min-h-[230px] overflow-hidden rounded-[2rem] border border-white/12 bg-black shadow-[0_30px_100px_-54px_rgba(34,211,238,0.7)] sm:min-h-[300px] lg:min-h-[560px]"
      initial={reducedMotion ? false : { opacity: 0, x: -24, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <Image
        src="/edupulse-hero.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 680px, 100vw"
        className="object-cover object-[66%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.42)_46%,rgba(0,0,0,0.08))]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
      <div className="relative z-10 flex h-full min-h-[230px] flex-col justify-end p-5 text-white sm:min-h-[300px] sm:p-7 lg:min-h-[560px] lg:p-9">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
          EduPulse access
        </p>
        <h2 className="max-w-sm text-3xl font-semibold leading-none tracking-tight sm:text-4xl lg:text-5xl">
          Your class, one tap away.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-white/72 sm:text-base">
          Learn, submit, message, and keep moving without noise.
        </p>
      </div>
    </motion.aside>
  );
}

function AuthField({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-cyan-600">
        {icon}
      </span>
      {children}
    </div>
  );
}

export function AuthPanel({ mode }: { mode: AuthPanelMode }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const isReset = mode === "reset";
  const [authMode, setAuthMode] = useState<AuthMode>(
    mode === "signup" ? "signup" : "login",
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [redirectBlocked, setRedirectBlocked] = useState("");
  const redirectTimerRef = useRef<number | null>(null);
  const {
    configured,
    loading,
    loginWithDemo,
    loginWithEmail,
    loginWithGoogle,
    repairSession,
    resetPassword,
    signUpWithEmail,
    user,
  } = useAuth();
  const demoMode = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
  const activeMode: AuthPanelMode = isReset ? "reset" : authMode;
  const copy = authCopy[activeMode];

  const verifiedWorkspaceTarget = useCallback(
    async (target: string) => {
      if (
        !target.startsWith("/student") &&
        !target.startsWith("/teacher") &&
        !target.startsWith("/admin")
      ) {
        return target;
      }

      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        user?: AuthUser;
      } | null;

      if (response.ok && payload?.user) {
        return canAccessPath(payload.user.role, target)
          ? target
          : homeForRole(payload.user.role);
      }

      const repaired = await repairSession();
      if (!repaired) {
        throw new Error(
          "We could not restore the previous session. Please sign in again.",
        );
      }

      return canAccessPath(repaired.role, target)
        ? target
        : homeForRole(repaired.role);
    },
    [repairSession],
  );

  const goToWorkspace = useCallback(
    async (target: string) => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
      setRedirectBlocked("");
      let safeTarget = target;

      try {
        safeTarget = await verifiedWorkspaceTarget(target);
      } catch (error) {
        setRedirectBlocked(
          error instanceof Error
            ? error.message
            : "Your secure workspace session is still being repaired.",
        );
        return;
      }

      router.replace(safeTarget);
      redirectTimerRef.current = window.setTimeout(() => {
        if (window.location.pathname !== safeTarget) {
          window.location.assign(safeTarget);
        }
      }, 900);
    },
    [router, verifiedWorkspaceTarget],
  );

  const targetForSession = useCallback(
    (result: AuthSessionResult) => {
      const localOnboardingCompleted = hasCompletedOnboarding(result.role, [
        result.uid,
        result.email,
        email,
      ]);
      const onboardingCompleted =
        result.onboardingCompleted || localOnboardingCompleted;

      if (onboardingCompleted) return homeForRole(result.role);
      if (result.role === "student") return "/onboarding/student";
      if (result.role === "teacher") return "/onboarding/teacher";
      return homeForRole(result.role);
    },
    [email],
  );

  useEffect(
    () => () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!user || isReset || redirectBlocked) return;

    if (user.onboardingCompleted) {
      void goToWorkspace(homeForRole(user.role));
      return;
    }

    if (user.role === "student") {
      void goToWorkspace("/onboarding/student");
      return;
    }

    if (user.role === "teacher") {
      void goToWorkspace("/onboarding/teacher");
      return;
    }

    void goToWorkspace(homeForRole(user.role));
  }, [goToWorkspace, isReset, redirectBlocked, user]);

  async function finish(result: AuthSessionResult) {
    await goToWorkspace(targetForSession(result));
  }

  function switchMode() {
    if (isReset) {
      router.push("/login");
      return;
    }
    setRedirectBlocked("");
    setAuthMode(authMode === "login" ? "signup" : "login");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setRedirectBlocked("");

    try {
      if (isReset) {
        await resetPassword(email);
        router.push("/login");
        return;
      }

      if (authMode === "signup") {
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

  if (!isReset && !redirectBlocked && (loading || user)) {
    return (
      <>
        <PublicNavbar />
        <main className="relative isolate min-h-dvh overflow-hidden px-4 pb-8 pt-28 text-white sm:px-6 lg:pt-32">
          <AuthBackdrop />
          <div className="mx-auto grid min-h-[calc(100dvh-9rem)] w-full max-w-6xl items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
            <AuthVisual reducedMotion={reducedMotion} />
            <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-white/60 bg-white/88 p-6 text-center text-slate-950 shadow-[0_28px_90px_-38px_rgba(34,211,238,0.9)] backdrop-blur-2xl lg:mx-0 lg:justify-self-end">
              <p className="text-lg font-semibold">Opening your dashboard</p>
              <p className="mt-2 text-sm text-slate-600">
                Restoring your secure session on this device.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PublicNavbar />
      <main className="relative isolate min-h-dvh overflow-x-hidden overflow-y-auto px-4 pb-8 pt-28 text-white sm:px-6 lg:pt-32">
        <AuthBackdrop />

        <div className="mx-auto grid min-h-[calc(100dvh-9rem)] w-full max-w-6xl items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <AuthVisual reducedMotion={reducedMotion} />

          <motion.section
            data-auth-card
            className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[2rem] border border-white/65 bg-white/88 px-6 pb-6 pt-7 text-slate-950 shadow-[0_30px_110px_-42px_rgba(34,211,238,0.95)] backdrop-blur-2xl sm:px-7 lg:mx-0 lg:justify-self-end"
            initial={
              reducedMotion ? false : { opacity: 0, x: 24, scale: 0.985 }
            }
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-20 size-56 rounded-full bg-cyan-300/30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-24 left-10 size-56 rounded-full bg-violet-500/18 blur-3xl"
            />

            <div className="relative z-10">
              <p className="mb-2 text-center text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">
                EduPulse access
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={copy.title}
                  className="text-center text-3xl font-bold tracking-normal text-slate-950"
                  initial={
                    reducedMotion ? false : { opacity: 0, y: 10, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reducedMotion
                      ? undefined
                      : { opacity: 0, y: -10, scale: 0.98 }
                  }
                  transition={{ duration: 0.2 }}
                >
                  {copy.title}
                </motion.h1>
              </AnimatePresence>
              <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-600">
                Securely continue to your learning workspace.
              </p>

              {!isReset && (
                <div className="mx-auto mt-5 grid h-11 max-w-[240px] grid-cols-2 rounded-full border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold text-slate-600 shadow-inner shadow-slate-300/40">
                  {(["login", "signup"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={authMode === item}
                      className={cn(
                        "relative isolate rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
                        authMode === item && "text-white",
                      )}
                      onClick={() => setAuthMode(item)}
                    >
                      {authMode === item && (
                        <motion.span
                          layoutId="auth-mode-pill"
                          className="absolute inset-0 -z-10 rounded-full bg-[linear-gradient(135deg,#0891b2,#4f46e5)] shadow-[0_14px_34px_-18px_rgba(14,165,233,0.9)]"
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 34,
                          }}
                        />
                      )}
                      {item === "login" ? "Sign In" : "Sign Up"}
                    </button>
                  ))}
                </div>
              )}

              {!isReset && redirectBlocked && (
                <motion.div
                  className="mt-5 rounded-3xl border border-cyan-200/80 bg-cyan-50/90 px-4 py-3 text-sm leading-6 text-slate-700 shadow-inner shadow-white/70"
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  Your previous browser session could not be restored
                  automatically. Sign in once and EduPulse will keep this device
                  connected.
                </motion.div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                <motion.form
                  key={activeMode}
                  action="/api/auth/admin-session"
                  className="mt-6 space-y-4"
                  method="post"
                  onSubmit={onSubmit}
                  initial={
                    reducedMotion
                      ? false
                      : { opacity: 0, x: authMode === "signup" ? 18 : -18 }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    reducedMotion
                      ? undefined
                      : { opacity: 0, x: authMode === "signup" ? -18 : 18 }
                  }
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <input
                    type="hidden"
                    name="deviceSessionId"
                    value="form-session"
                  />
                  {activeMode === "signup" && (
                    <AuthField icon={<UserRound className="size-4" />}>
                      <Input
                        aria-label="Full name"
                        name="displayName"
                        placeholder="Full name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        className="h-12 rounded-full border-slate-200 bg-white/86 pl-11 text-slate-950 shadow-[0_16px_40px_-30px_rgba(14,165,233,0.65)] placeholder:text-slate-400 focus:border-cyan-500/70 focus:ring-cyan-500/20"
                      />
                    </AuthField>
                  )}
                  <AuthField icon={<Mail className="size-4" />}>
                    <Input
                      aria-label={
                        isReset ? "Email address" : "Username or email"
                      }
                      name="email"
                      type="email"
                      placeholder={isReset ? "Email address" : "Email address"}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="h-12 rounded-full border-slate-200 bg-white/86 pl-11 text-slate-950 shadow-[0_16px_40px_-30px_rgba(14,165,233,0.65)] placeholder:text-slate-400 focus:border-cyan-500/70 focus:ring-cyan-500/20"
                    />
                  </AuthField>
                  {!isReset && (
                    <AuthField icon={<LockKeyhole className="size-4" />}>
                      <Input
                        aria-label="Password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        className="h-12 rounded-full border-slate-200 bg-white/86 pl-11 pr-12 text-slate-950 shadow-[0_16px_40px_-30px_rgba(14,165,233,0.65)] placeholder:text-slate-400 focus:border-cyan-500/70 focus:ring-cyan-500/20"
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-3 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-500 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70"
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </AuthField>
                  )}
                  <Button
                    className="h-12 w-full rounded-full bg-[linear-gradient(135deg,#06b6d4,#4f46e5_58%,#a855f7)] text-white shadow-[0_24px_54px_-28px_rgba(14,165,233,0.9)] hover:shadow-[0_28px_64px_-30px_rgba(79,70,229,0.9)]"
                    type="submit"
                    disabled={busy}
                  >
                    {copy.submit}
                    <ArrowRight />
                  </Button>
                </motion.form>
              </AnimatePresence>

              {!isReset && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-full border-slate-200 bg-white/80 text-slate-800 hover:bg-cyan-50 hover:text-slate-950"
                    disabled={busy}
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
                      className="mt-3 h-11 w-full rounded-2xl bg-cyan-600 text-white hover:bg-cyan-500"
                      disabled={busy}
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

              <div className="mt-5 space-y-3 text-sm text-slate-600">
                {!configured && (
                  <p className="rounded-2xl border border-amber-300/30 bg-amber-300/12 p-3 text-amber-100">
                    Email and social sign-in are not available right now.
                  </p>
                )}
                <div className="flex items-center justify-between gap-3">
                  {activeMode === "login" ? (
                    <Link
                      href="/reset-password"
                      className="hover:text-cyan-700"
                    >
                      Forget Password
                    </Link>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="font-medium text-cyan-700 underline-offset-4 hover:text-cyan-950 hover:underline"
                    onClick={switchMode}
                  >
                    {copy.switchAction}
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </>
  );
}
