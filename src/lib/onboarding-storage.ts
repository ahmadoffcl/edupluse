import type { Role } from "@/lib/types";

const onboardingPrefix = "edupulse.onboarding.completed";

function normalizeIdentity(identity?: string | null) {
  return identity?.trim().toLowerCase() || null;
}

export function onboardingStorageKey(role: Role, identity?: string | null) {
  return `${onboardingPrefix}.${role}.${normalizeIdentity(identity) ?? "unknown"}`;
}

export function markOnboardingComplete(
  role: Role,
  identities: Array<string | null | undefined>,
) {
  if (typeof window === "undefined") return;

  for (const identity of identities) {
    const normalized = normalizeIdentity(identity);
    if (normalized) {
      window.localStorage.setItem(
        onboardingStorageKey(role, normalized),
        "true",
      );
    }
  }
}

export function hasCompletedOnboarding(
  role: Role,
  identities: Array<string | null | undefined>,
) {
  if (typeof window === "undefined") return false;

  return identities.some((identity) => {
    const normalized = normalizeIdentity(identity);
    return (
      Boolean(normalized) &&
      window.localStorage.getItem(onboardingStorageKey(role, normalized)) ===
        "true"
    );
  });
}
