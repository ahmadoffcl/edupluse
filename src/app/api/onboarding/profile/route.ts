import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  username: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^@?[a-zA-Z0-9._]+$/)
    .optional(),
  bio: z.string().trim().max(180).optional(),
});

function cleanUsername(username?: string) {
  return username?.replace(/^@+/, "").toLowerCase();
}

export async function POST(request: Request) {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Workspace data is unavailable." },
      { status: 503 },
    );
  }

  const body = schema.parse(await request.json());
  const username = cleanUsername(body.username);

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("firebase_uid", session.uid)
    .maybeSingle();

  if (currentProfileError) {
    return NextResponse.json(
      { error: "Unable to load your profile." },
      { status: 500 },
    );
  }

  if (!currentProfile) {
    return NextResponse.json(
      { error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  if (username) {
    const { data: existingProfile, error: existingProfileError } =
      await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", currentProfile.id)
        .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json(
        { error: "Unable to check username." },
        { status: 500 },
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 },
      );
    }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      display_name: body.displayName ?? session.displayName,
      username: username ?? null,
      bio: body.bio ?? null,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", currentProfile.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Unable to save your onboarding profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
