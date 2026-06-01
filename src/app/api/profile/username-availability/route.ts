import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppSession } from "@/lib/auth/server";
import {
  ensureSessionProfile,
  isAdminRole,
} from "@/lib/server/workflow-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  isValidUsername,
  normalizeUsername,
  usernameValidationMessage,
} from "@/lib/username";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session) {
    return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json(
      { message: "Username checks are unavailable right now." },
      { status: 503 },
    );
  }

  const username = normalizeUsername(request.nextUrl.searchParams.get("username"));
  const mode =
    request.nextUrl.searchParams.get("mode") === "new" ? "new" : "current";

  if (!username || !isValidUsername(username)) {
    return NextResponse.json(
      {
        available: false,
        username,
        message: usernameValidationMessage(username) ?? "Username is invalid.",
      },
      { status: 400 },
    );
  }

  let currentProfileId: string | null = null;
  if (mode === "current" || isAdminRole(session.role)) {
    currentProfileId = await ensureSessionProfile(supabase, session).catch(
      () => null,
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: "Unable to check username right now." },
      { status: 500 },
    );
  }

  const available =
    !data?.id || (mode === "current" && data.id === currentProfileId);

  return NextResponse.json({
    available,
    username,
    message: available
      ? `@${username} is available.`
      : `@${username} is already taken.`,
  });
}
