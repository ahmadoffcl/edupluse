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

export const runtime = "nodejs";

const schema = z.object({
  emails: z.string().min(3),
  role: z.enum(["student", "teacher", "admin"]),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(7),
  department: z.string().trim().max(120).optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  section: z.string().trim().max(80).optional().nullable(),
  maxUses: z.coerce.number().int().min(1).max(500).default(1),
  personalMessage: z.string().trim().max(500).optional().nullable(),
  temporaryPermissions: z
    .record(z.string(), z.unknown())
    .optional()
    .default({}),
});
const emailSchema = z.string().email();

function parseEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n;]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export async function POST(request: Request) {
  const context = await requireWorkflowContext(["admin", "super_admin"], {
    profileRequired: false,
  });
  if (isWorkflowResponse(context)) return context;

  const body = schema.parse(await request.json());
  const emails = parseEmails(body.emails);
  const invalidEmail = emails.find(
    (email) => !emailSchema.safeParse(email).success,
  );

  if (emails.length === 0 || invalidEmail) {
    return NextResponse.json(
      { ok: false, error: "Add valid email addresses only." },
      { status: 400 },
    );
  }

  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);

  const created = [];

  for (const email of emails) {
    const token = createInviteToken();
    const code = createInviteCode();
    const { data, error } = await context.supabase
      .from("invites")
      .insert({
        org_id: context.session.orgId,
        email,
        role: body.role,
        token_hash: hashInviteSecret(token),
        code_hash: hashInviteSecret(code),
        expires_at: expiresAt.toISOString(),
        created_by: context.profileId,
        department: body.department || null,
        class_id: body.classId || null,
        section: body.section || null,
        max_uses: body.maxUses,
        personal_message: body.personalMessage || null,
        temporary_permissions: body.temporaryPermissions,
      })
      .select("id,email,role,expires_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Unable to create invite for ${email}.` },
        { status: 500 },
      );
    }

    created.push({
      id: data.id as string,
      email,
      role: data.role as string,
      expiresAt: data.expires_at as string,
      token,
      code,
      inviteUrl: `${new URL(request.url).origin}/invite/${token}`,
    });
  }

  await writeAuditLog(context, {
    action: "admin.invites.created",
    entity: "invites",
    metadata: {
      count: created.length,
      role: body.role,
      classId: body.classId || null,
    },
  });

  return NextResponse.json({ ok: true, invites: created });
}
