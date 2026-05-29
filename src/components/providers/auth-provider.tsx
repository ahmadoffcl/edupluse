"use client";

import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseAuthUser,
  updateProfile,
} from "firebase/auth";
import { toast } from "sonner";
import {
  getFirebaseAuth,
  getGoogleProvider,
  getPersistentFirebaseAuth,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { isDemoModeEnabled } from "@/lib/config";
import { demoOrg, demoUsers } from "@/lib/mock-data";
import {
  hasCompletedOnboarding,
  markOnboardingComplete,
} from "@/lib/onboarding-storage";
import type { AuthSessionResult, AuthUser, Role } from "@/lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  loginWithEmail: (
    email: string,
    password: string,
  ) => Promise<AuthSessionResult>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<AuthSessionResult>;
  loginWithGoogle: () => Promise<AuthSessionResult>;
  loginWithDemo: (role: Role) => Promise<AuthSessionResult>;
  resetPassword: (email: string) => Promise<void>;
  repairSession: () => Promise<AuthSessionResult | null>;
  logout: () => Promise<void>;
  setRole: (role: Role) => Promise<void>;
  updateUserProfile: (updates: {
    displayName?: string;
    photoURL?: string | null;
  }) => void;
  token: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const storageKey = "lumina.demo.session";
const localAdminStorageKey = "edupulse.admin.session";
const localAdminEmailStorageKey = "edupulse.admin.email";

function userFromLocalAdmin(email?: string | null): AuthUser {
  return {
    uid: "local-admin",
    email: email ?? "admin",
    displayName: "EduPulse Admin",
    emailVerified: true,
    role: "admin",
    orgId: "11111111-1111-4111-8111-111111111111",
    orgName: "EduPulse Academy Network",
    deviceSessionId: createDeviceSessionId(),
    onboardingCompleted: true,
  };
}

function createDeviceSessionId() {
  if (typeof window === "undefined") return "server-session";
  const existing = window.localStorage.getItem("lumina.device.session");
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem("lumina.device.session", id);
  return id;
}

async function waitForFirebaseUser(timeoutMs = 3_500) {
  const auth = await getPersistentFirebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  return new Promise<FirebaseAuthUser | null>((resolve) => {
    let settled = false;
    let timeout: number;
    let unsubscribe = () => {};
    const finish = (firebaseUser: FirebaseAuthUser | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(firebaseUser);
    };
    timeout = window.setTimeout(() => finish(auth.currentUser), timeoutMs);
    unsubscribe = onAuthStateChanged(auth, finish);
  });
}

function userFromDemoRole(role: Role): AuthUser {
  const demo = demoUsers[role];

  return {
    uid: demo.uid,
    email: demo.email,
    displayName: demo.displayName,
    emailVerified: true,
    role,
    orgId: demoOrg.id,
    orgName: demoOrg.name,
    deviceSessionId: createDeviceSessionId(),
    onboardingCompleted: false,
  };
}

function persistDemoRole(role: Role) {
  window.localStorage.setItem(storageKey, role);
}

function applyLocalRole(
  setUser: Dispatch<SetStateAction<AuthUser | null>>,
  role: Role,
) {
  window.localStorage.setItem("lumina.active.role", role);
  setUser((current) =>
    current
      ? {
          ...current,
          role,
        }
      : userFromDemoRole(role),
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const restoredSessionRef = useRef(false);
  const configured = isFirebaseConfigured();
  const demoMode = isDemoModeEnabled();

  const createServerSession = useCallback(
    async (
      role?: Role,
      idToken?: string | null,
      details?: {
        displayName?: string | null;
        email?: string | null;
        orgId?: string;
        orgName?: string;
        allowSelfSignup?: boolean;
      },
    ) => {
      const fallbackUser = userFromDemoRole(role ?? "student");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 9_000);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          idToken,
          role,
          displayName: details?.displayName ?? fallbackUser.displayName,
          email: details?.email ?? fallbackUser.email,
          orgId: details?.orgId ?? fallbackUser.orgId,
          orgName: details?.orgName ?? fallbackUser.orgName,
          allowSelfSignup: details?.allowSelfSignup ?? false,
          deviceSessionId: createDeviceSessionId(),
        }),
      }).finally(() => window.clearTimeout(timeout));

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Unable to create secure app session.");
      }

      const session = (await response.json()) as {
        role: Role;
        orgId: string;
        orgName: string;
        photoURL?: string | null;
        onboardingCompleted: boolean;
        setupPending?: boolean;
      };
      const verification = await fetch("/api/auth/session", {
        cache: "no-store",
      });

      if (!verification.ok) {
        throw new Error(
          "Your browser blocked the secure app session. Please sign in again.",
        );
      }

      return session;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const restoreController = new AbortController();
    const restoreTimer = window.setTimeout(
      () => restoreController.abort(),
      1_500,
    );
    const authFallbackTimer = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 2_500);

    void (async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          signal: restoreController.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          user?: AuthUser;
        } | null;

        if (!cancelled && response.ok && payload?.user) {
          restoredSessionRef.current = true;
          window.localStorage.setItem("lumina.active.role", payload.user.role);
          setUser(payload.user);
          setLoading(false);
        }
      } catch {
        // Firebase restoration below remains the source of truth if the cookie
        // session is absent, expired, or slow.
      } finally {
        window.clearTimeout(restoreTimer);
      }
    })();

    const demoRole = window.localStorage.getItem(storageKey) as Role | null;
    if (demoRole && demoUsers[demoRole]) {
      queueMicrotask(() => {
        restoredSessionRef.current = true;
        setUser(userFromDemoRole(demoRole));
        setLoading(false);
      });
    }

    if (window.localStorage.getItem(localAdminStorageKey) === "true") {
      queueMicrotask(() => {
        restoredSessionRef.current = true;
        setUser(
          userFromLocalAdmin(
            window.localStorage.getItem(localAdminEmailStorageKey),
          ),
        );
        setLoading(false);
      });
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      queueMicrotask(() => setLoading(false));
      return () => {
        cancelled = true;
        restoreController.abort();
        window.clearTimeout(restoreTimer);
        window.clearTimeout(authFallbackTimer);
      };
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      window.clearTimeout(authFallbackTimer);
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      void (async () => {
        const displayName =
          firebaseUser.displayName ??
          firebaseUser.email?.split("@")[0] ??
          "EduPulse user";

        try {
          let session: Awaited<ReturnType<typeof createServerSession>>;
          try {
            session = await createServerSession(
              undefined,
              await firebaseUser.getIdToken(false),
              {
                displayName,
                email: firebaseUser.email,
                allowSelfSignup: true,
              },
            );
          } catch {
            session = await createServerSession(
              undefined,
              await firebaseUser.getIdToken(true),
              {
                displayName,
                email: firebaseUser.email,
                allowSelfSignup: true,
              },
            );
          }

          if (cancelled) return;

          if (session.onboardingCompleted) {
            markOnboardingComplete(session.role, [
              firebaseUser.uid,
              firebaseUser.email,
            ]);
          }

          window.localStorage.setItem("lumina.active.role", session.role);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName,
            photoURL: session.photoURL ?? firebaseUser.photoURL,
            emailVerified: firebaseUser.emailVerified,
            role: session.role,
            orgId: session.orgId,
            orgName: session.orgName,
            deviceSessionId: createDeviceSessionId(),
            onboardingCompleted:
              session.onboardingCompleted ||
              hasCompletedOnboarding(session.role, [
                firebaseUser.uid,
                firebaseUser.email,
              ]),
          });
        } catch {
          if (cancelled) return;
          if (!restoredSessionRef.current) {
            window.localStorage.removeItem("lumina.active.role");
            setUser(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      restoreController.abort();
      window.clearTimeout(restoreTimer);
      window.clearTimeout(authFallbackTimer);
      unsubscribe();
    };
  }, [createServerSession]);

  const setRole = useCallback(
    async (role: Role) => {
      if (user?.uid === "local-admin") {
        if (role !== "admin") {
          throw new Error("This admin account only has admin access.");
        }

        applyLocalRole(setUser, "admin");
        return;
      }

      const auth = await getPersistentFirebaseAuth();
      const firebaseUser = auth?.currentUser;

      await createServerSession(role, await firebaseUser?.getIdToken(false), {
        displayName:
          firebaseUser?.displayName ??
          firebaseUser?.email?.split("@")[0] ??
          undefined,
        email: firebaseUser?.email ?? undefined,
      });
      applyLocalRole(setUser, role);
    },
    [createServerSession, user?.uid],
  );

  const loginWithDemo = useCallback(
    async (role: Role) => {
      if (!demoMode) {
        throw new Error("Demo mode is disabled.");
      }

      await createServerSession(role, null);
      persistDemoRole(role);
      setUser(userFromDemoRole(role));
      toast.success("Demo workspace opened", {
        description: `Signed in as ${role.replace("_", " ")}.`,
      });
      return {
        uid: demoUsers[role].uid,
        email: demoUsers[role].email,
        role,
        orgId: demoOrg.id,
        orgName: demoOrg.name,
        onboardingCompleted: false,
      };
    },
    [createServerSession, demoMode],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const adminResponse = await fetch("/api/auth/admin-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          deviceSessionId: createDeviceSessionId(),
        }),
      });

      if (adminResponse.ok) {
        window.localStorage.setItem(localAdminStorageKey, "true");
        window.localStorage.setItem(localAdminEmailStorageKey, email);
        window.localStorage.setItem("lumina.active.role", "admin");
        setUser(userFromLocalAdmin(email));
        toast.success("Signed in");
        return {
          uid: "local-admin",
          email,
          role: "admin" as const,
          orgId: "11111111-1111-4111-8111-111111111111",
          orgName: "EduPulse Academy Network",
          onboardingCompleted: true,
        };
      }

      if (adminResponse.status === 429) {
        const data = (await adminResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Too many attempts. Try again later.");
      }

      const auth = await getPersistentFirebaseAuth();
      if (!auth && demoMode) {
        return loginWithDemo("student");
      }
      if (!auth) throw new Error("Sign-in is not configured.");

      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      let session: Awaited<ReturnType<typeof createServerSession>>;
      try {
        session = await createServerSession(
          undefined,
          await credential.user.getIdToken(false),
          {
            displayName:
              credential.user.displayName ??
              credential.user.email?.split("@")[0] ??
              "EduPulse user",
            email: credential.user.email,
            allowSelfSignup: true,
          },
        );
      } catch {
        session = await createServerSession(
          undefined,
          await credential.user.getIdToken(true),
          {
            displayName:
              credential.user.displayName ??
              credential.user.email?.split("@")[0] ??
              "EduPulse user",
            email: credential.user.email,
            allowSelfSignup: true,
          },
        );
      }
      if (session.onboardingCompleted) {
        markOnboardingComplete(session.role, [
          credential.user.uid,
          credential.user.email,
        ]);
      }
      window.localStorage.setItem("lumina.active.role", session.role);
      void fetch("/api/email/login", { method: "POST" });
      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName:
          credential.user.displayName ??
          credential.user.email?.split("@")[0] ??
          "EduPulse user",
        photoURL: session.photoURL ?? credential.user.photoURL,
        emailVerified: credential.user.emailVerified,
        role: session.role,
        orgId: session.orgId,
        orgName: session.orgName,
        deviceSessionId: createDeviceSessionId(),
        onboardingCompleted: session.onboardingCompleted,
      });
      toast.success("Signed in");
      return {
        ...session,
        uid: credential.user.uid,
        email: credential.user.email,
      };
    },
    [createServerSession, demoMode, loginWithDemo],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      const auth = await getPersistentFirebaseAuth();
      if (!auth && demoMode) {
        return loginWithDemo("student");
      }
      if (!auth) throw new Error("Sign-in is not configured.");

      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await updateProfile(credential.user, { displayName });
      await sendEmailVerification(credential.user);
      const session = await createServerSession(
        undefined,
        await credential.user.getIdToken(true),
        {
          displayName,
          email: credential.user.email,
          allowSelfSignup: true,
        },
      );
      window.localStorage.setItem("lumina.active.role", session.role);
      void fetch("/api/email/welcome", { method: "POST" });
      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName,
        photoURL: session.photoURL ?? credential.user.photoURL,
        emailVerified: credential.user.emailVerified,
        role: session.role,
        orgId: session.orgId,
        orgName: session.orgName,
        deviceSessionId: createDeviceSessionId(),
        onboardingCompleted: session.onboardingCompleted,
      });
      toast.success("Account created", {
        description: "Verification email sent.",
      });
      return {
        ...session,
        uid: credential.user.uid,
        email: credential.user.email,
        onboardingCompleted: false,
      };
    },
    [createServerSession, demoMode, loginWithDemo],
  );

  const loginWithGoogle = useCallback(async () => {
    const auth = await getPersistentFirebaseAuth();
    if (!auth && demoMode) {
      return loginWithDemo("student");
    }
    if (!auth) throw new Error("Sign-in is not configured.");

    const credential = await signInWithPopup(auth, getGoogleProvider());
    const session = await createServerSession(
      undefined,
      await credential.user.getIdToken(true),
      {
        displayName:
          credential.user.displayName ??
          credential.user.email?.split("@")[0] ??
          "EduPulse user",
        email: credential.user.email,
        allowSelfSignup: true,
      },
    );
    if (session.onboardingCompleted) {
      markOnboardingComplete(session.role, [
        credential.user.uid,
        credential.user.email,
      ]);
    }
    window.localStorage.setItem("lumina.active.role", session.role);
    void fetch("/api/email/login", { method: "POST" });
    setUser({
      uid: credential.user.uid,
      email: credential.user.email,
      displayName:
        credential.user.displayName ??
        credential.user.email?.split("@")[0] ??
        "EduPulse user",
      photoURL: session.photoURL ?? credential.user.photoURL,
      emailVerified: credential.user.emailVerified,
      role: session.role,
      orgId: session.orgId,
      orgName: session.orgName,
      deviceSessionId: createDeviceSessionId(),
      onboardingCompleted: session.onboardingCompleted,
    });
    toast.success("Signed in with Google");
    return {
      ...session,
      uid: credential.user.uid,
      email: credential.user.email,
    };
  }, [createServerSession, demoMode, loginWithDemo]);

  const resetPassword = useCallback(async (email: string) => {
    const auth = await getPersistentFirebaseAuth();
    if (!auth) {
      toast.info("Password reset unavailable", {
        description: "Password reset email is not configured yet.",
      });
      return;
    }

    await sendPasswordResetEmail(auth, email);
    void fetch("/api/email/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    toast.success("Password reset email sent");
  }, []);

  const repairSession = useCallback(async () => {
    const firebaseUser = await waitForFirebaseUser();
    if (!firebaseUser) return null;

    const displayName =
      firebaseUser.displayName ??
      firebaseUser.email?.split("@")[0] ??
      "EduPulse user";
    let session: Awaited<ReturnType<typeof createServerSession>>;

    try {
      session = await createServerSession(
        undefined,
        await firebaseUser.getIdToken(false),
        {
          displayName,
          email: firebaseUser.email,
          allowSelfSignup: true,
        },
      );
    } catch {
      session = await createServerSession(
        undefined,
        await firebaseUser.getIdToken(true),
        {
          displayName,
          email: firebaseUser.email,
          allowSelfSignup: true,
        },
      );
    }

    if (session.onboardingCompleted) {
      markOnboardingComplete(session.role, [
        firebaseUser.uid,
        firebaseUser.email,
      ]);
    }

    window.localStorage.setItem("lumina.active.role", session.role);
    const nextUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName,
      photoURL: session.photoURL ?? firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      role: session.role,
      orgId: session.orgId,
      orgName: session.orgName,
      deviceSessionId: createDeviceSessionId(),
      onboardingCompleted:
        session.onboardingCompleted ||
        hasCompletedOnboarding(session.role, [
          firebaseUser.uid,
          firebaseUser.email,
        ]),
    };

    setUser(nextUser);

    return {
      ...session,
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      onboardingCompleted: nextUser.onboardingCompleted,
    };
  }, [createServerSession]);

  const updateUserProfile = useCallback(
    (updates: { displayName?: string; photoURL?: string | null }) => {
      setUser((current) => (current ? { ...current, ...updates } : current));
    },
    [],
  );

  const logout = useCallback(async () => {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(localAdminStorageKey);
    window.localStorage.removeItem(localAdminEmailStorageKey);
    window.localStorage.removeItem("lumina.active.role");
    setUser(null);
    await fetch("/api/auth/session", { method: "DELETE" });

    const auth = getFirebaseAuth();
    if (auth?.currentUser) {
      await signOut(auth);
    }
  }, []);

  const token = useCallback(async () => {
    const auth = getFirebaseAuth();
    return (await auth?.currentUser?.getIdToken(false)) ?? null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured,
      loginWithEmail,
      signUpWithEmail,
      loginWithGoogle,
      loginWithDemo,
      resetPassword,
      repairSession,
      logout,
      setRole,
      updateUserProfile,
      token,
    }),
    [
      configured,
      loading,
      loginWithDemo,
      loginWithEmail,
      loginWithGoogle,
      logout,
      repairSession,
      resetPassword,
      setRole,
      signUpWithEmail,
      token,
      updateUserProfile,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
