import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import {
  createInviteCode,
  createInviteToken,
  hashInviteSecret,
} from "@/lib/server/invite-tokens";
import { sendEduPulseEmail } from "@/lib/email/server";

export const runtime = "nodejs";

const schema = z.object({
  classId: z.string().uuid(),
  role: z.enum(["student", "teacher"]).default("student"),
  expiresInDays: z.coerce.number().int().min(1).max(60).default(7),
  maxUses: z.coerce.number().int().min(1).max(200).default(30),
  emails: z.array(z.string().trim().email()).max(50).optional().default([]),
  section: z.string().trim().max(80).optional().nullable(),
  personalMessage: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const body = schema.parse(await request.json());
  const classAccess = await requireClassAccess(context, body.classId);
  if (isWorkflowResponse(classAccess)) return classAccess;

  const token = createInviteToken();
  const code = createInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);

  const { data, error } = await context.supabase
    .from("invites")
    .insert({
      org_id: context.session.orgId,
      email: null,
      role: body.role,
      token_hash: hashInviteSecret(token),
      code_hash: hashInviteSecret(code),
      expires_at: expiresAt.toISOString(),
      created_by: context.profileId,
      class_id: body.classId,
      section: body.section || null,
      max_uses: body.maxUses,
      personal_message: body.personalMessage || null,
      temporary_permissions: {},
    })
    .select("id,expires_at,max_uses")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to create class invite." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.invite.created",
    entity: "invites",
    entityId: data.id,
    metadata: { classId: body.classId, maxUses: body.maxUses, role: body.role },
  });

  const inviteUrl = `${new URL(request.url).origin}/invite/${token}`;
  if (body.emails.length) {
    await Promise.allSettled(
      body.emails.map((email) =>
        sendEduPulseEmail({
          to: email,
          subject: `${context.session.displayName} invited you to ${classAccess?.name ?? "a class"}`,
          eyebrow: "Class invitation",
          title: "You have a class invite.",
          body:
            body.role === "teacher"
              ? `${context.session.displayName} invited you to collaborate as a teacher in ${classAccess?.name ?? "an EduPulse class"}. Open the secure invite link, create your account, and the class owner will approve your access.`
              : `${context.session.displayName} invited you to join ${classAccess?.name ?? "an EduPulse class"}. Open the secure invite link, create your password, and the class will be added to your workspace.`,
          detailLabel: "Class",
          detailValue: classAccess?.name ?? "EduPulse class",
          actionLabel: "Join class",
          actionUrl: inviteUrl,
        }),
      ),
    );
  }

  return NextResponse.json({
    ok: true,
    invite: {
      id: data.id,
      token,
      code,
      expiresAt: data.expires_at,
      inviteUrl,
    },
    emailed: body.emails.length,
  });
}
