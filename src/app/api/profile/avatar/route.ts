import { NextResponse } from "next/server";
import { getCurrentAppSession } from "@/lib/auth/server";
import { ensureSessionProfile } from "@/lib/server/workflow-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const maxAvatarBytes = 5 * 1024 * 1024;

function isMissingStorage(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { statusCode?: string; message?: string };
  return (
    candidate.statusCode === "404" ||
    Boolean(candidate.message?.toLowerCase().includes("bucket"))
  );
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

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Choose a profile image first." },
      { status: 400 },
    );
  }

  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WEBP, or GIF image." },
      { status: 400 },
    );
  }

  if (file.size > maxAvatarBytes) {
    return NextResponse.json(
      { error: "Profile image must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  const profileId = await ensureSessionProfile(supabase, session);
  if (!profileId) {
    return NextResponse.json(
      { error: "Profile is not ready yet. Sign out and sign in again." },
      { status: 404 },
    );
  }

  const filePath = `${session.orgId}/avatars/${profileId}-${Date.now()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const upload = await supabase.storage
    .from("avatars")
    .upload(filePath, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (upload.error) {
    return NextResponse.json(
      {
        error: isMissingStorage(upload.error)
          ? "Profile image storage is not configured yet."
          : "Unable to upload profile image.",
      },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  const avatarUrl = data.publicUrl;
  const update = await supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (update.error) {
    await supabase.storage.from("avatars").remove([filePath]);
    return NextResponse.json(
      { error: "Profile image uploaded, but profile could not be updated." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, avatarUrl });
}
