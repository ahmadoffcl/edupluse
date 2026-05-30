import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import { hashInviteSecret, inviteStatus } from "@/lib/server/invite-tokens";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(4).max(80),
});

export async function POST(request: Request) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const body = schema.parse(await request.json());
  const codeHash = hashInviteSecret(body.code);
  const { data, error } = await context.supabase
    .from("invites")
    .select(
      "id,org_id,role,expires_at,accepted_at,revoked_at,class_id,max_uses,used_count,classes(name)",
    )
    .eq("org_id", context.session.orgId)
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Class code was not found." },
      { status: 404 },
    );
  }

  const invite = data as Record<string, unknown>;
  const status = inviteStatus({
    expires_at: invite.expires_at as string,
    accepted_at: invite.accepted_at as string | null,
    revoked_at: invite.revoked_at as string | null,
    max_uses: invite.max_uses as number | null,
    used_count: invite.used_count as number | null,
  });
  const classId = String(invite.class_id ?? "");

  if (invite.role !== "student" || !classId || status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "This class code is no longer available." },
      { status: 400 },
    );
  }

  const { error: enrollmentError } = await context.supabase
    .from("enrollments")
    .upsert(
      {
        org_id: context.session.orgId,
        class_id: classId,
        student_id: context.profileId,
        status: "enrolled",
        enrolled_at: new Date().toISOString(),
      },
      { onConflict: "class_id,student_id" },
    );

  if (enrollmentError) {
    return NextResponse.json(
      { ok: false, error: "Unable to join this class." },
      { status: 500 },
    );
  }

  await context.supabase
    .from("invites")
    .update({ used_count: Number(invite.used_count ?? 0) + 1 })
    .eq("id", String(invite.id));

  await writeAuditLog(context, {
    action: "student.class_code.joined",
    entity: "classes",
    entityId: classId,
    metadata: { inviteId: invite.id },
  });

  const classRelation = invite.classes as
    | { name?: string }
    | { name?: string }[]
    | null;
  const classRecord = Array.isArray(classRelation)
    ? classRelation[0]
    : classRelation;

  return NextResponse.json({
    ok: true,
    classId,
    className: classRecord?.name ?? "Class",
  });
}
