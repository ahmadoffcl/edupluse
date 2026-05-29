import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { getCurrentAppSession } from "@/lib/auth/server";
import { canAccessPath, homeForRole } from "@/lib/permissions";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, params] = await Promise.all([
    getCurrentAppSession(),
    searchParams,
  ]);
  const next = Array.isArray(params?.next) ? params?.next[0] : params?.next;

  if (session) {
    const target =
      next && next.startsWith("/") && canAccessPath(session.role, next)
        ? next
        : homeForRole(session.role);
    redirect(target);
  }

  return (
    <Suspense>
      <AuthPanel mode="login" />
    </Suspense>
  );
}
