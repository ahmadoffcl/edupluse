import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  displayName: z.string().trim().min(1).max(120),
  username: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^@?[a-zA-Z0-9._]+$/)
    .optional()
    .nullable(),
  bio: z.string().trim().max(300).optional().nullable(),
  tagline: z.string().trim().max(120).optional().nullable(),
  officeHours: z.string().trim().max(180).optional().nullable(),
  gradingTargetHours: z.coerce.number().int().min(1).max(720).optional(),
  aiAssistance: z.boolean().optional().default(true),
});

function cleanUsername(username?: string | null) {
  return username?.replace(/^@+/, "").toLowerCase() || null;
}

export async function PATCH(request: Request) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const body = schema.parse(await request.json());
  const username = cleanUsername(body.username);

  if (username) {
    const { data: existingProfile, error: existingProfileError } =
      await context.supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", context.profileId)
        .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json(
        { ok: false, error: "Unable to check username." },
        { status: 500 },
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        { ok: false, error: "That username is already taken." },
        { status: 409 },
      );
    }
  }

  const teacherSettings = {
    tagline: body.tagline || "",
    officeHours: body.officeHours || "",
    gradingTargetHours: body.gradingTargetHours ?? 48,
    aiAssistance: body.aiAssistance,
  };
  const { data, error } = await context.supabase
    .from("profiles")
    .update({
      display_name: body.displayName,
      username,
      bio: body.bio || null,
      teacher_settings: teacherSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.profileId)
    .select("id,display_name,username,bio,teacher_settings")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to save teacher settings." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.settings.updated",
    entity: "profiles",
    entityId: context.profileId,
  });

  return NextResponse.json({ ok: true, profile: data });
}
